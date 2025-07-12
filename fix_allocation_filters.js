import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function fixAllocationFilters() {
  console.log('🔧 修复apply_allocation_filters函数...');
  
  try {
    await connectDB();

    // 1. 检查当前函数源码
    console.log('\n🔍 检查当前函数源码:');
    const currentFunction = await executeQuery(`
      SELECT prosrc FROM pg_proc WHERE proname = 'apply_allocation_filters'
    `);
    
    if (currentFunction.success && currentFunction.data.length > 0) {
      const source = currentFunction.data[0].prosrc;
      console.log('✅ 找到当前函数，长度:', source.length);
      
      // 检查关键部分
      if (source.includes('community_matched_users')) {
        console.log('✅ 函数包含community_matched_users变量');
      }
      if (source.includes('filtered_users := community_matched_users')) {
        console.log('✅ 函数包含社区匹配结果应用逻辑');
      } else {
        console.log('❌ 函数缺少社区匹配结果应用逻辑');
      }
    }

    // 2. 重新创建修复后的函数
    console.log('\n🔧 创建修复后的函数...');
    const fixedFunction = `
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
                  -- 调用社区匹配函数
                  community_json := match_community_to_organization(p_community, filtered_users);
                  community_matched_users := jsonb_to_bigint_array(community_json -> 'matched_users');

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

    const fixResult = await executeQuery(fixedFunction);
    if (fixResult.success) {
      console.log('✅ 函数修复成功');
    } else {
      console.log('❌ 函数修复失败:', fixResult.error);
    }

    // 3. 测试修复后的函数
    console.log('\n🧪 测试修复后的函数:');
    const testResult = await executeQuery(`
      SELECT 
        apply_allocation_filters(
          ARRAY[1,2,3,4,5], -- 候选用户
          6, -- 用户组ID
          '浦江公园社区'::community, -- 目标社区
          false, -- 不启用质量控制
          true, -- 启用社区匹配
          false -- 不启用权限检查
        ) as result
    `);

    if (testResult.success && testResult.data.length > 0) {
      const result = testResult.data[0].result;
      console.log(`✅ 修复后测试结果: ${result}`);
      
      if (result && result.includes(4) && result.length === 1) {
        console.log('✅ 社区匹配正确：只包含用户ID 4');
      } else if (result && result.includes(4)) {
        console.log('⚠️ 社区匹配部分正确：包含用户ID 4，但还有其他用户');
      } else {
        console.log('❌ 社区匹配仍有问题：不包含用户ID 4');
      }
    }

    // 4. 测试浦江中心社区
    console.log('\n🧪 测试浦江中心社区:');
    const testCenter = await executeQuery(`
      SELECT 
        apply_allocation_filters(
          ARRAY[1,2,3,4,5], -- 候选用户
          6, -- 用户组ID
          '浦江中心社区'::community, -- 目标社区
          false, -- 不启用质量控制
          true, -- 启用社区匹配
          false -- 不启用权限检查
        ) as result
    `);

    if (testCenter.success && testCenter.data.length > 0) {
      const result = testCenter.data[0].result;
      console.log(`✅ 浦江中心社区测试结果: ${result}`);
      
      if (result && result.includes(5) && result.length === 1) {
        console.log('✅ 浦江中心社区匹配正确：只包含用户ID 5');
      } else if (result && result.includes(5)) {
        console.log('⚠️ 浦江中心社区匹配部分正确：包含用户ID 5，但还有其他用户');
      } else {
        console.log('❌ 浦江中心社区匹配有问题：不包含用户ID 5');
      }
    }

    // 5. 测试无社区匹配的情况
    console.log('\n🧪 测试无社区匹配:');
    const testNoCommunity = await executeQuery(`
      SELECT 
        apply_allocation_filters(
          ARRAY[1,2,3,4,5], -- 候选用户
          6, -- 用户组ID
          NULL::community, -- 无社区
          false, -- 不启用质量控制
          true, -- 启用社区匹配
          false -- 不启用权限检查
        ) as result
    `);

    if (testNoCommunity.success && testNoCommunity.data.length > 0) {
      const result = testNoCommunity.data[0].result;
      console.log(`✅ 无社区测试结果: ${result}`);
      
      if (result && result.length === 5) {
        console.log('✅ 无社区匹配正确：返回所有候选用户');
      } else {
        console.log('❌ 无社区匹配有问题');
      }
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

fixAllocationFilters(); 