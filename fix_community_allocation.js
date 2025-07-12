import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function fixCommunityAllocation() {
  console.log('🔧 修复社区分配逻辑...');
  
  try {
    await connectDB();

    // 1. 检查apply_allocation_filters函数中的社区匹配逻辑
    console.log('\n🔍 检查apply_allocation_filters函数:');
    const filterFunction = await executeQuery(`
      SELECT prosrc FROM pg_proc WHERE proname = 'apply_allocation_filters'
    `);
    
    if (filterFunction.success && filterFunction.data.length > 0) {
      const source = filterFunction.data[0].prosrc;
      console.log('✅ 找到apply_allocation_filters函数');
      
      // 检查是否包含社区匹配逻辑
      if (source.includes('match_community_to_organization')) {
        console.log('✅ 函数包含社区匹配逻辑');
      } else {
        console.log('❌ 函数缺少社区匹配逻辑');
      }
      
      if (source.includes('community_matched_users')) {
        console.log('✅ 函数处理社区匹配结果');
      } else {
        console.log('❌ 函数未处理社区匹配结果');
      }
    }

    // 2. 测试社区匹配是否正常工作
    console.log('\n🧪 测试社区匹配:');
    const testMatch = await executeQuery(`
      SELECT 
        apply_allocation_filters(
          ARRAY[1,2,3,4,5], -- 候选用户
          6, -- 用户组ID (默认销售组)
          '浦江公园社区'::community, -- 目标社区
          true, -- 启用质量控制
          true, -- 启用社区匹配
          false -- 不启用权限检查
        ) as filtered_users
    `);

    if (testMatch.success && testMatch.data.length > 0) {
      const result = testMatch.data[0].filtered_users;
      console.log(`✅ 社区匹配测试结果: ${result}`);
    }

    // 3. 检查用户组6的社区匹配配置
    console.log('\n👥 检查用户组6配置:');
    const group6Config = await executeQuery(`
      SELECT 
        id,
        groupname,
        list,
        enable_community_matching,
        enable_quality_control
      FROM users_list
      WHERE id = 6
    `);

    if (group6Config.success && group6Config.data.length > 0) {
      const config = group6Config.data[0];
      console.log(`✅ 用户组6配置:`);
      console.log(`   名称: ${config.groupname}`);
      console.log(`   用户列表: ${config.list}`);
      console.log(`   社区匹配: ${config.enable_community_matching}`);
      console.log(`   质量控制: ${config.enable_quality_control}`);
    }

    // 4. 检查最近的分配日志，看看社区匹配是否被应用
    console.log('\n📊 检查最近分配日志中的社区匹配:');
    const recentAllocations = await executeQuery(`
      SELECT 
        l.leadid,
        l.assigned_user_id,
        l.processing_details
      FROM simple_allocation_logs l
      WHERE l.created_at >= NOW() - INTERVAL '1 hour'
        AND l.processing_details::text ILIKE '%浦江公园社区%'
      ORDER BY l.created_at DESC
      LIMIT 3
    `);

    if (recentAllocations.success && recentAllocations.data.length > 0) {
      console.log(`✅ 找到 ${recentAllocations.data.length} 条浦江公园社区分配记录:`);
      recentAllocations.data.forEach((log, index) => {
        console.log(`\n${index + 1}. 线索ID: ${log.leadid}`);
        console.log(`   分配用户: ${log.assigned_user_id}`);
        console.log(`   处理详情: ${JSON.stringify(log.processing_details, null, 2)}`);
      });
    }

    // 5. 修复分配函数，确保社区匹配被正确应用
    console.log('\n🔧 修复分配函数...');
    const fixAllocationFunction = `
      CREATE OR REPLACE FUNCTION public.apply_allocation_filters (
        candidate_users           bigint[],
        group_id                  bigint,
        p_community               community,
        enable_quality_control    boolean,
        enable_community_matching boolean,
        enable_permission_check   boolean
      ) RETURNS bigint[]
      LANGUAGE plpgsql
      AS $$
      DECLARE
          filtered_users          bigint[] := candidate_users;
          community_json          jsonb;
          community_matched_users bigint[];
          group_enable_quality    boolean;
          group_enable_comm_match boolean;
          dbg jsonb := jsonb_build_object(
              'input_users',                candidate_users,
              'group_id',                   group_id,
              'community',                  p_community,
              'enable_quality_control_arg', enable_quality_control,
              'enable_community_matching_arg', enable_community_matching,
              'enable_permission_check',    enable_permission_check
          );
      BEGIN
          ------------------------------------------------------------------
          -- 0. 空数组直接返回
          ------------------------------------------------------------------
          IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
              dbg := dbg || '{"input_empty":true}';
              RETURN NULL;
          END IF;

          ------------------------------------------------------------------
          -- 1. 读取用户组配置
          ------------------------------------------------------------------
          SELECT 
              COALESCE(ul.enable_quality_control,    false),
              COALESCE(ul.enable_community_matching, false)
          INTO
              group_enable_quality,
              group_enable_comm_match
          FROM users_list ul
          WHERE ul.id = group_id;
          
          dbg := dbg || jsonb_build_object(
              'group_enable_quality',    group_enable_quality,
              'group_enable_comm_match', group_enable_comm_match
          );

          ------------------------------------------------------------------
          -- 2. 质量控制过滤
          ------------------------------------------------------------------
          IF group_enable_quality AND enable_quality_control THEN
              BEGIN
              filtered_users := filter_users_by_quality_control(filtered_users, group_id);
                  dbg := dbg || jsonb_build_object('after_quality', filtered_users);

                  IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                      dbg := dbg || '{"quality_filtered_all":true}';
                      RETURN NULL;
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('quality_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 3. 权限检查过滤
          ------------------------------------------------------------------
          IF enable_permission_check THEN
              BEGIN
              filtered_users := filter_users_by_permission(filtered_users);
                  dbg := dbg || jsonb_build_object('after_permission', filtered_users);

                  IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                      dbg := dbg || '{"permission_filtered_all":true}';
                      RETURN NULL;
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('permission_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 4. 社区优先推荐 (修复：确保社区匹配被正确应用)
          ------------------------------------------------------------------
          IF group_enable_comm_match AND enable_community_matching
             AND p_community IS NOT NULL THEN
              BEGIN
                  community_json := match_community_to_organization(p_community,
                                                                    filtered_users);
                  community_matched_users :=
                      jsonb_to_bigint_array(community_json -> 'matched_users');

                  dbg := dbg || jsonb_build_object(
                      'community_json',      community_json,
                      'community_matched',   community_matched_users
                  );
              
                  -- 修复：如果社区匹配成功，优先使用社区匹配的用户
                  IF community_matched_users IS NOT NULL
                     AND array_length(community_matched_users,1) > 0 THEN
                      filtered_users := community_matched_users;
                      dbg := dbg || jsonb_build_object('community_priority_applied', true);
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('community_match_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 5. 写入最终日志并返回
          ------------------------------------------------------------------
          dbg := dbg || jsonb_build_object(
              'final_users', filtered_users,
              'final_cnt',   COALESCE(array_length(filtered_users,1),0)
          );

          RETURN filtered_users;
      END;
      $$;
    `;

    const fixResult = await executeQuery(fixAllocationFunction);
    if (fixResult.success) {
      console.log('✅ 分配函数修复成功');
    } else {
      console.log('❌ 分配函数修复失败:', fixResult.error);
    }

    // 6. 测试修复后的分配
    console.log('\n🧪 测试修复后的分配:');
    const testAllocation = await executeQuery(`
      SELECT 
        apply_allocation_filters(
          ARRAY[1,2,3,4,5], -- 候选用户
          6, -- 用户组ID
          '浦江公园社区'::community, -- 目标社区
          true, -- 启用质量控制
          true, -- 启用社区匹配
          false -- 不启用权限检查
        ) as result
    `);

    if (testAllocation.success && testAllocation.data.length > 0) {
      const result = testAllocation.data[0].result;
      console.log(`✅ 修复后测试结果: ${result}`);
      if (result && result.includes(4)) {
        console.log('✅ 社区匹配正确：浦江公园社区分配给用户ID 4');
      } else {
        console.log('❌ 社区匹配仍有问题');
      }
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

fixCommunityAllocation(); 