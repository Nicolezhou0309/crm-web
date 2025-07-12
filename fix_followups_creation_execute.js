import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function fixFollowupsCreation() {
  console.log('🔧 修复followups创建问题...');
  
  try {
    // 连接数据库
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败');
      return;
    }

    // 1. 首先检查当前的触发器函数
    console.log('\n📋 检查当前触发器函数...');
    const triggerFunction = await executeQuery(`
      SELECT 
        proname as function_name,
        prosrc as function_source
      FROM pg_proc 
      WHERE proname = 'simple_lead_allocation_trigger'
    `);

    if (triggerFunction.success && triggerFunction.data.length > 0) {
      console.log('✅ 当前触发器函数存在');
    } else {
      console.log('❌ 触发器函数不存在，需要重新创建');
    }

    // 2. 修复触发器函数
    console.log('\n🔧 修复触发器函数...');
    const fixTriggerFunction = `
      CREATE OR REPLACE FUNCTION public.simple_lead_allocation_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
          allocation_result jsonb;
          target_user_id bigint;
          lead_community community;
          debug_info jsonb := '{}';
          followup_created boolean := false;
      BEGIN
          -- 从remark中提取community信息
          IF NEW.remark IS NOT NULL AND NEW.remark ~ '\\[COMMUNITY:([^\\]]+)\\]' THEN
              SELECT (regexp_match(NEW.remark, '\\[COMMUNITY:([^\\]]+)\\]'))[1]::community INTO lead_community;
              debug_info := debug_info || jsonb_build_object('community_from_remark', lead_community);
          END IF;
          
          -- 如果remark中没有community信息，从广告信息推导
          IF lead_community IS NULL THEN
              SELECT community INTO lead_community
              FROM community_keywords
              WHERE EXISTS (
                SELECT 1 FROM unnest(keyword) AS k
                WHERE
                  (NEW.campaignname ILIKE '%' || k || '%'
                   OR NEW.unitname ILIKE '%' || k || '%'
                   OR NEW.remark ILIKE '%' || k || '%')
              )
              ORDER BY priority DESC
              LIMIT 1;
              debug_info := debug_info || jsonb_build_object('community_from_keywords', lead_community);
          END IF;
          
          -- 如果仍然没有匹配到，使用默认值
          IF lead_community IS NULL THEN
              SELECT enumlabel::community INTO lead_community
              FROM pg_enum 
              WHERE enumtypid = 'community'::regtype 
              ORDER BY enumsortorder 
              LIMIT 1;
              debug_info := debug_info || jsonb_build_object('community_default', lead_community);
          END IF;
          
          -- 执行分配
          BEGIN
              allocation_result := allocate_lead_simple(
                  NEW.leadid,
                  NEW.source,
                  NEW.leadtype,
                  lead_community,
                  NULL  -- 手动分配用户
              );
              
              debug_info := debug_info || jsonb_build_object('allocation_result', allocation_result);
              
              -- 获取分配结果
              IF allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean THEN
                  target_user_id := (allocation_result->>'assigned_user_id')::bigint;
                  debug_info := debug_info || jsonb_build_object('target_user_id', target_user_id);
                  
                  -- 创建followups记录
                  IF target_user_id IS NOT NULL THEN
                      -- 检查用户是否存在
                      IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                          RAISE EXCEPTION '用户ID % 不存在', target_user_id;
                      END IF;
                      
                      -- 检查leadid是否已存在followups记录
                      IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
                          BEGIN
                              INSERT INTO public.followups (
                                  leadid, 
                                  leadtype, 
                                  followupstage, 
                                  interviewsales_user_id,
                                  created_at, 
                                  updated_at
                              ) VALUES (
                                  NEW.leadid, 
                                  NEW.leadtype, 
                                  '待接收', 
                                  target_user_id,
                                  NOW(), 
                                  NOW()
                              );
                              followup_created := true;
                              debug_info := debug_info || jsonb_build_object('followup_created', true);
                          EXCEPTION WHEN OTHERS THEN
                              debug_info := debug_info || jsonb_build_object(
                                  'followup_creation_error', SQLERRM,
                                  'followup_creation_error_detail', SQLSTATE
                              );
                              -- 不抛出异常，继续执行
                          END;
                      ELSE
                          debug_info := debug_info || jsonb_build_object('followup_already_exists', true);
                      END IF;
                  ELSE
                      debug_info := debug_info || jsonb_build_object('target_user_id_null', true);
                  END IF;
              ELSE
                  -- 记录分配失败的情况
                  debug_info := debug_info || jsonb_build_object('allocation_failed', true);
              END IF;
              
              -- 记录详细的处理日志
              INSERT INTO simple_allocation_logs (
                  leadid,
                  assigned_user_id,
                  processing_details
              ) VALUES (
                  NEW.leadid,
                  target_user_id,
                  jsonb_build_object(
                      'allocation_success', allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean,
                      'followup_created', followup_created,
                      'debug_info', debug_info
                  )
              );
              
          EXCEPTION WHEN OTHERS THEN
              -- 记录异常情况
              INSERT INTO simple_allocation_logs (
                  leadid,
                  processing_details
              ) VALUES (
                  NEW.leadid,
                  jsonb_build_object(
                      'error', SQLERRM,
                      'error_detail', SQLSTATE,
                      'debug_info', debug_info
                  )
              );
          END;
          
          RETURN NEW;
      END;
      $$;
    `;

    const fixResult = await executeQuery(fixTriggerFunction);
    if (fixResult.success) {
      console.log('✅ 触发器函数修复成功');
    } else {
      console.log('❌ 触发器函数修复失败:', fixResult.error);
      return;
    }

    // 3. 为已分配但未创建followups的记录创建followups
    console.log('\n🔧 为已分配但未创建followups的记录创建followups...');
    const createMissingFollowups = `
      INSERT INTO followups (
          leadid, 
          leadtype, 
          followupstage, 
          interviewsales_user_id,
          created_at, 
          updated_at
      )
      SELECT 
          l.leadid,
          leads.leadtype,
          '待接收',
          l.assigned_user_id,
          l.created_at,
          l.created_at
      FROM simple_allocation_logs l
      JOIN leads ON l.leadid = leads.leadid
      LEFT JOIN followups f ON l.leadid = f.leadid
      WHERE l.assigned_user_id IS NOT NULL
        AND f.leadid IS NULL
        AND l.created_at >= NOW() - INTERVAL '24 hours'
        AND (l.processing_details->>'allocation_success')::boolean = true
      ON CONFLICT (leadid) DO NOTHING;
    `;

    const createResult = await executeQuery(createMissingFollowups);
    if (createResult.success) {
      console.log('✅ 缺失的followups记录创建成功');
    } else {
      console.log('❌ 创建缺失followups记录失败:', createResult.error);
    }

    // 4. 验证修复结果
    console.log('\n📊 验证修复结果...');
    const verifyResult = await executeQuery(`
      SELECT 
          '修复统计' as info,
          COUNT(*) as total_allocated,
          COUNT(CASE WHEN f.leadid IS NOT NULL THEN 1 END) as with_followups,
          COUNT(CASE WHEN f.leadid IS NULL THEN 1 END) as without_followups
      FROM simple_allocation_logs l
      LEFT JOIN followups f ON l.leadid = f.leadid
      WHERE l.created_at >= NOW() - INTERVAL '24 hours'
        AND l.assigned_user_id IS NOT NULL
    `);

    if (verifyResult.success && verifyResult.data.length > 0) {
      const stat = verifyResult.data[0];
      console.log(`✅ 修复后24小时内分配统计:`);
      console.log(`   总分配数: ${stat.total_allocated}`);
      console.log(`   有followups记录: ${stat.with_followups}`);
      console.log(`   无followups记录: ${stat.without_followups}`);
      console.log(`   成功率: ${stat.total_allocated > 0 ? ((stat.with_followups / stat.total_allocated) * 100).toFixed(2) : 0}%`);
    }

    // 5. 测试新线索分配
    console.log('\n🧪 测试新线索分配...');
    const testLead = await executeQuery(`
      INSERT INTO leads (
          leadid, 
          phone, 
          wechat, 
          source, 
          leadtype, 
          remark,
          created_at
      ) VALUES (
          'TEST_FIX_' || EXTRACT(EPOCH FROM NOW())::text,
          '13800138000',
          'test_wechat',
          '抖音',
          '意向客户',
          '[COMMUNITY:浦江中心社区] 测试修复后的分配功能',
          NOW()
      ) RETURNING leadid;
    `);

    if (testLead.success && testLead.data.length > 0) {
      const testLeadId = testLead.data[0].leadid;
      console.log(`✅ 测试线索创建成功: ${testLeadId}`);
      
      // 等待一下让触发器执行
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查测试线索的分配结果
      const testResult = await executeQuery(`
        SELECT 
          l.leadid,
          l.assigned_user_id,
          l.processing_details,
          f.leadid as followup_leadid,
          f.interviewsales_user_id as followup_user_id
        FROM simple_allocation_logs l
        LEFT JOIN followups f ON l.leadid = f.leadid
        WHERE l.leadid = $1
      `, [testLeadId]);

      if (testResult.success && testResult.data.length > 0) {
        const test = testResult.data[0];
        console.log(`\n📋 测试线索分配结果:`);
        console.log(`   线索ID: ${test.leadid}`);
        console.log(`   分配用户ID: ${test.assigned_user_id}`);
        console.log(`   是否创建followups: ${test.followup_leadid ? '是' : '否'}`);
        if (test.followup_leadid) {
          console.log(`   Followups用户ID: ${test.followup_user_id}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

// 执行修复
fixFollowupsCreation(); 