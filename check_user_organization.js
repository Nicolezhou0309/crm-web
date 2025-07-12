import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function checkUserOrganization() {
  console.log('🔍 检查用户与组织对应关系...');
  
  try {
    await connectDB();

    // 1. 检查所有用户及其组织
    console.log('\n👤 检查所有用户及其组织:');
    const allUsers = await executeQuery(`
      SELECT 
        up.id,
        up.nickname,
        up.organization_id,
        o.name as organization_name,
        o.parent_id as org_parent_id
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.status = 'active'
      ORDER BY up.id
    `);

    if (allUsers.success) {
      console.log(`✅ 找到 ${allUsers.data.length} 个活跃用户:`);
      allUsers.data.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.nickname} (ID: ${user.id})`);
        console.log(`   组织ID: ${user.organization_id}`);
        console.log(`   组织名称: ${user.organization_name || '未设置'}`);
        console.log(`   上级组织ID: ${user.org_parent_id || '无'}`);
      });
    }

    // 2. 检查所有组织
    console.log('\n🏢 检查所有组织:');
    const allOrganizations = await executeQuery(`
      SELECT 
        id,
        name,
        parent_id,
        created_at
      FROM organizations
      ORDER BY id
    `);

    if (allOrganizations.success) {
      console.log(`✅ 找到 ${allOrganizations.data.length} 个组织:`);
      allOrganizations.data.forEach((org, index) => {
        console.log(`\n${index + 1}. ${org.name} (ID: ${org.id})`);
        console.log(`   上级组织ID: ${org.parent_id || '无'}`);
        console.log(`   创建时间: ${org.created_at}`);
      });
    }

    // 3. 检查用户ID 4的完整组织链
    console.log('\n🔗 检查用户ID 4的完整组织链:');
    const user4Chain = await executeQuery(`
      WITH RECURSIVE org_chain AS (
        SELECT up.id AS uid,
               up.organization_id AS org_id,
               o.name AS org_name,
               0 AS level
        FROM users_profile up
        LEFT JOIN organizations o ON up.organization_id = o.id
        WHERE up.id = 4

        UNION ALL

        SELECT oc.uid,
               o.parent_id AS org_id,
               o.name AS org_name,
               oc.level + 1
        FROM org_chain oc
        JOIN organizations o ON o.id = oc.org_id
        WHERE o.parent_id IS NOT NULL
      )
      SELECT * FROM org_chain
      ORDER BY level
    `);

    if (user4Chain.success) {
      console.log(`✅ 用户ID 4的组织链:`);
      user4Chain.data.forEach((chain, index) => {
        console.log(`\n${index + 1}. 级别 ${chain.level}: ${chain.org_name || '未设置'} (ID: ${chain.org_id})`);
      });
    }

    // 4. 检查用户ID 5的完整组织链
    console.log('\n🔗 检查用户ID 5的完整组织链:');
    const user5Chain = await executeQuery(`
      WITH RECURSIVE org_chain AS (
        SELECT up.id AS uid,
               up.organization_id AS org_id,
               o.name AS org_name,
               0 AS level
        FROM users_profile up
        LEFT JOIN organizations o ON up.organization_id = o.id
        WHERE up.id = 5

        UNION ALL

        SELECT oc.uid,
               o.parent_id AS org_id,
               o.name AS org_name,
               oc.level + 1
        FROM org_chain oc
        JOIN organizations o ON o.id = oc.org_id
        WHERE o.parent_id IS NOT NULL
      )
      SELECT * FROM org_chain
      ORDER BY level
    `);

    if (user5Chain.success) {
      console.log(`✅ 用户ID 5的组织链:`);
      user5Chain.data.forEach((chain, index) => {
        console.log(`\n${index + 1}. 级别 ${chain.level}: ${chain.org_name || '未设置'} (ID: ${chain.org_id})`);
      });
    }

    // 5. 测试社区匹配函数的详细执行
    console.log('\n🧪 测试社区匹配函数的详细执行:');
    const detailedMatch = await executeQuery(`
      WITH RECURSIVE org_chain AS (
        SELECT up.id AS uid,
               up.organization_id AS org_id
        FROM users_profile up
        WHERE up.id = ANY(ARRAY[1,2,3,4,5])

        UNION ALL

        SELECT oc.uid,
               o.parent_id AS org_id
        FROM org_chain oc
        JOIN organizations o ON o.id = oc.org_id
        WHERE o.parent_id IS NOT NULL
      ),
      matched AS (
        SELECT DISTINCT oc.uid
        FROM org_chain oc
        JOIN organizations o ON o.id = oc.org_id
        WHERE o.name = '浦江公园社区'
      )
      SELECT 
        array_agg(uid) as matched_users,
        array_length(array_agg(uid), 1) as matched_count
      FROM matched
    `);

    if (detailedMatch.success && detailedMatch.data.length > 0) {
      const result = detailedMatch.data[0];
      console.log('✅ 详细匹配结果:');
      console.log(`   匹配用户: ${result.matched_users}`);
      console.log(`   匹配数量: ${result.matched_count}`);
    }

    // 6. 检查是否有组织名称与社区名称不匹配
    console.log('\n🔍 检查组织名称与社区名称匹配:');
    const orgCommunityMatch = await executeQuery(`
      SELECT 
        o.id,
        o.name as org_name,
        o.parent_id
      FROM organizations o
      WHERE o.name ILIKE '%浦江%'
      ORDER BY o.id
    `);

    if (orgCommunityMatch.success) {
      console.log(`✅ 浦江相关组织:`);
      orgCommunityMatch.data.forEach((org, index) => {
        console.log(`\n${index + 1}. ${org.org_name} (ID: ${org.id})`);
        console.log(`   上级组织ID: ${org.parent_id || '无'}`);
      });
    }

    // 7. 检查用户组6中的用户是否都有组织
    console.log('\n👥 检查用户组6中的用户组织:');
    const group6Users = await executeQuery(`
      SELECT 
        up.id,
        up.nickname,
        up.organization_id,
        o.name as organization_name
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.id = ANY(ARRAY[1,2,5,3,4])
        AND up.status = 'active'
      ORDER BY up.id
    `);

    if (group6Users.success) {
      console.log(`✅ 用户组6中的用户组织:`);
      group6Users.data.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.nickname} (ID: ${user.id})`);
        console.log(`   组织ID: ${user.organization_id || '未设置'}`);
        console.log(`   组织名称: ${user.organization_name || '未设置'}`);
      });
    }

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

checkUserOrganization(); 