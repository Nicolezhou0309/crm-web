import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function debugMatchFunction() {
  console.log('🔍 深入调试match_community_to_organization函数...');
  
  try {
    await connectDB();

    // 1. 获取函数源码
    console.log('\n🔧 获取函数源码:');
    const functionSource = await executeQuery(`
      SELECT prosrc FROM pg_proc WHERE proname = 'match_community_to_organization'
    `);
    
    if (functionSource.success && functionSource.data.length > 0) {
      const source = functionSource.data[0].prosrc;
      console.log('✅ 函数源码长度:', source.length);
      console.log('\n📄 函数源码:');
      console.log(source);
    }

    // 2. 测试函数的基本功能
    console.log('\n🧪 测试函数基本功能:');
    const basicTest = await executeQuery(`
      SELECT 
        match_community_to_organization('浦江公园社区'::community, ARRAY[1,2,3,4,5]) as park_result,
        match_community_to_organization('浦江中心社区'::community, ARRAY[1,2,3,4,5]) as center_result,
        match_community_to_organization('未知社区'::community, ARRAY[1,2,3,4,5]) as unknown_result
    `);

    if (basicTest.success && basicTest.data.length > 0) {
      const result = basicTest.data[0];
      console.log('✅ 基本功能测试结果:');
      console.log(`   浦江公园社区: ${JSON.stringify(result.park_result)}`);
      console.log(`   浦江中心社区: ${JSON.stringify(result.center_result)}`);
      console.log(`   未知社区: ${JSON.stringify(result.unknown_result)}`);
    }

    // 3. 检查community枚举类型
    console.log('\n🏘️ 检查community枚举类型:');
    const enumValues = await executeQuery(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'community')
      ORDER BY enumsortorder
    `);

    if (enumValues.success) {
      console.log(`✅ community枚举值:`);
      enumValues.data.forEach((val, index) => {
        console.log(`   ${index + 1}. ${val.enumlabel}`);
      });
    }

    // 4. 检查用户组6的用户列表格式
    console.log('\n👥 检查用户组6的用户列表格式:');
    const groupUsers = await executeQuery(`
      SELECT 
        list,
        array_length(list, 1) as list_length,
        list::text as list_text
      FROM users_list
      WHERE id = 6
    `);

    if (groupUsers.success && groupUsers.data.length > 0) {
      const group = groupUsers.data[0];
      console.log(`✅ 用户组6信息:`);
      console.log(`   用户列表: ${group.list}`);
      console.log(`   列表长度: ${group.list_length}`);
      console.log(`   列表文本: ${group.list_text}`);
      
      // 检查用户ID 4是否在列表中
      if (group.list && group.list.includes(4)) {
        console.log('✅ 用户ID 4在用户组6中');
      } else {
        console.log('❌ 用户ID 4不在用户组6中');
      }
    }

    // 5. 测试apply_allocation_filters的详细执行过程
    console.log('\n🔍 测试apply_allocation_filters详细执行:');
    const detailedTest = await executeQuery(`
      WITH test_data AS (
        SELECT 
          ARRAY[1,2,3,4,5] as candidate_users,
          6 as group_id,
          '浦江公园社区'::community as target_community,
          false as enable_quality,
          true as enable_community,
          false as enable_permission
      )
      SELECT 
        candidate_users,
        group_id,
        target_community,
        enable_quality,
        enable_community,
        enable_permission,
        apply_allocation_filters(
          candidate_users,
          group_id,
          target_community,
          enable_quality,
          enable_community,
          enable_permission
        ) as filtered_result
      FROM test_data
    `);

    if (detailedTest.success && detailedTest.data.length > 0) {
      const test = detailedTest.data[0];
      console.log('✅ 详细测试结果:');
      console.log(`   候选用户: ${test.candidate_users}`);
      console.log(`   用户组ID: ${test.group_id}`);
      console.log(`   目标社区: ${test.target_community}`);
      console.log(`   质量控制: ${test.enable_quality}`);
      console.log(`   社区匹配: ${test.enable_community}`);
      console.log(`   权限检查: ${test.enable_permission}`);
      console.log(`   过滤结果: ${test.filtered_result}`);
    }

    // 6. 检查用户组配置
    console.log('\n⚙️ 检查用户组配置:');
    const groupConfig = await executeQuery(`
      SELECT 
        id,
        groupname,
        list,
        enable_community_matching,
        enable_quality_control
      FROM users_list
      WHERE id = 6
    `);

    if (groupConfig.success && groupConfig.data.length > 0) {
      const config = groupConfig.data[0];
      console.log(`✅ 用户组6配置:`);
      console.log(`   ID: ${config.id}`);
      console.log(`   名称: ${config.groupname}`);
      console.log(`   用户列表: ${config.list}`);
      console.log(`   社区匹配: ${config.enable_community_matching}`);
      console.log(`   质量控制: ${config.enable_quality_control}`);
    }

    // 7. 手动测试社区匹配逻辑
    console.log('\n🔧 手动测试社区匹配逻辑:');
    const manualTest = await executeQuery(`
      SELECT 
        '浦江公园社区'::community as test_community,
        ARRAY[1,2,3,4,5] as test_users,
        match_community_to_organization('浦江公园社区'::community, ARRAY[1,2,3,4,5]) as match_result,
        jsonb_to_bigint_array(match_community_to_organization('浦江公园社区'::community, ARRAY[1,2,3,4,5]) -> 'matched_users') as matched_users_array
    `);

    if (manualTest.success && manualTest.data.length > 0) {
      const test = manualTest.data[0];
      console.log('✅ 手动测试结果:');
      console.log(`   测试社区: ${test.test_community}`);
      console.log(`   测试用户: ${test.test_users}`);
      console.log(`   匹配结果: ${JSON.stringify(test.match_result)}`);
      console.log(`   匹配用户数组: ${test.matched_users_array}`);
    }

  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

debugMatchFunction(); 