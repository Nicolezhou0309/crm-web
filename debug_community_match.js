import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function debugCommunityMatch() {
  console.log('🔍 深入调试社区匹配...');
  
  try {
    await connectDB();

    // 1. 检查match_community_to_organization函数的实现
    console.log('\n🔧 检查match_community_to_organization函数:');
    const matchFunction = await executeQuery(`
      SELECT prosrc FROM pg_proc WHERE proname = 'match_community_to_organization'
    `);
    
    if (matchFunction.success && matchFunction.data.length > 0) {
      const source = matchFunction.data[0].prosrc;
      console.log('✅ 找到match_community_to_organization函数');
      console.log('函数源码长度:', source.length);
      
      // 检查关键逻辑
      if (source.includes('浦江公园社区')) {
        console.log('✅ 函数包含浦江公园社区逻辑');
      }
      if (source.includes('浦江中心社区')) {
        console.log('✅ 函数包含浦江中心社区逻辑');
      }
    }

    // 2. 直接测试社区匹配函数
    console.log('\n🧪 直接测试社区匹配函数:');
    const directTest = await executeQuery(`
      SELECT 
        match_community_to_organization('浦江公园社区'::community, ARRAY[1,2,3,4,5]) as park_result,
        match_community_to_organization('浦江中心社区'::community, ARRAY[1,2,3,4,5]) as center_result
    `);

    if (directTest.success && directTest.data.length > 0) {
      const result = directTest.data[0];
      console.log('✅ 直接测试结果:');
      console.log(`   浦江公园社区: ${JSON.stringify(result.park_result)}`);
      console.log(`   浦江中心社区: ${JSON.stringify(result.center_result)}`);
    }

    // 3. 检查社区关键词映射表
    console.log('\n🏘️ 检查社区关键词映射:');
    const keywords = await executeQuery(`
      SELECT 
        keyword,
        community,
        priority
      FROM community_keywords
      WHERE keyword ILIKE '%浦江%'
      ORDER BY priority DESC
    `);

    if (keywords.success) {
      console.log(`✅ 找到 ${keywords.data.length} 条浦江相关关键词:`);
      keywords.data.forEach((kw, index) => {
        console.log(`\n${index + 1}. 关键词: ${kw.keyword}`);
        console.log(`   对应社区: ${kw.community}`);
        console.log(`   优先级: ${kw.priority}`);
      });
    }

    // 4. 检查用户与社区的对应关系
    console.log('\n👤 检查用户社区对应关系:');
    const userCommunity = await executeQuery(`
      SELECT 
        up.id,
        up.nickname,
        up.community
      FROM users_profile up
      WHERE up.status = 'active'
      ORDER BY up.id
    `);

    if (userCommunity.success) {
      console.log(`✅ 用户社区对应关系:`);
      userCommunity.data.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.nickname} (ID: ${user.id})`);
        console.log(`   社区: ${user.community || '未设置'}`);
      });
    }

    // 5. 检查apply_allocation_filters函数的详细执行过程
    console.log('\n🔍 检查apply_allocation_filters执行过程:');
    const debugFilter = await executeQuery(`
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

    if (debugFilter.success && debugFilter.data.length > 0) {
      const result = debugFilter.data[0].result;
      console.log(`✅ apply_allocation_filters结果: ${result}`);
      
      if (result && result.includes(4)) {
        console.log('✅ 社区匹配正确：包含用户ID 4');
      } else {
        console.log('❌ 社区匹配问题：不包含用户ID 4');
      }
    }

    // 6. 检查用户组6的用户列表
    console.log('\n👥 检查用户组6的用户列表:');
    const groupUsers = await executeQuery(`
      SELECT 
        list
      FROM users_list
      WHERE id = 6
    `);

    if (groupUsers.success && groupUsers.data.length > 0) {
      const userList = groupUsers.data[0].list;
      console.log(`✅ 用户组6用户列表: ${userList}`);
      
      // 检查用户ID 4是否在列表中
      if (userList && userList.includes(4)) {
        console.log('✅ 用户ID 4在用户组6中');
      } else {
        console.log('❌ 用户ID 4不在用户组6中');
      }
    }

    // 7. 检查社区匹配函数的详细逻辑
    console.log('\n🔧 检查社区匹配函数逻辑:');
    const testCommunityLogic = await executeQuery(`
      WITH test_data AS (
        SELECT 
          '浦江公园社区'::community as test_community,
          ARRAY[1,2,3,4,5] as test_users
      )
      SELECT 
        test_community,
        test_users,
        match_community_to_organization(test_community, test_users) as match_result
      FROM test_data
    `);

    if (testCommunityLogic.success && testCommunityLogic.data.length > 0) {
      const test = testCommunityLogic.data[0];
      console.log('✅ 社区匹配函数测试:');
      console.log(`   测试社区: ${test.test_community}`);
      console.log(`   测试用户: ${test.test_users}`);
      console.log(`   匹配结果: ${JSON.stringify(test.match_result)}`);
    }

    // 8. 检查是否有其他分配规则干扰
    console.log('\n📋 检查分配规则优先级:');
    const rules = await executeQuery(`
      SELECT 
        id,
        name,
        priority,
        conditions,
        user_groups,
        is_active
      FROM simple_allocation_rules
      WHERE is_active = true
      ORDER BY priority DESC
    `);

    if (rules.success) {
      console.log(`✅ 活跃分配规则:`);
      rules.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   用户组: ${rule.user_groups}`);
        console.log(`   是否活跃: ${rule.is_active}`);
      });
    }

  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

debugCommunityMatch(); 