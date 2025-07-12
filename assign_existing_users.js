import { connectDB, executeQuery, closeConnection } from './db-connect.js';

// 为用户分配角色的函数
async function assignRoleToUser(email, roleName) {
  const query = `
    INSERT INTO user_roles (user_id, role_id)
    SELECT 
        up.user_id,
        r.id
    FROM users_profile up
    CROSS JOIN roles r
    WHERE up.email = $1
        AND r.name = $2
    ON CONFLICT (user_id, role_id) DO NOTHING;
  `;
  
  const result = await executeQuery(query, [email, roleName]);
  return result;
}

// 主函数
async function assignRolesToExistingUsers() {
  console.log('👥 开始为现有用户分配角色...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出分配');
      return;
    }
    
    // 2. 查看现有用户
    console.log('\n📋 查看现有用户...');
    const usersResult = await executeQuery(`
      SELECT 
          up.id,
          up.nickname,
          up.email,
          up.status,
          o.name as organization_name
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.status = 'active'
      ORDER BY up.nickname
    `);
    
    if (usersResult.success) {
      console.log(`   找到 ${usersResult.data.length} 个活跃用户:`);
      usersResult.data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.nickname} (${user.email || '无邮箱'}) - ${user.organization_name || '未分配部门'}`);
      });
    }
    
    // 3. 查看现有角色
    console.log('\n🎭 查看可用角色...');
    const rolesResult = await executeQuery('SELECT id, name, description FROM roles ORDER BY name');
    if (rolesResult.success) {
      console.log('   可用角色:');
      rolesResult.data.forEach(role => {
        console.log(`   - ${role.name}: ${role.description}`);
      });
    }
    
    // 4. 查看现有用户角色分配
    console.log('\n🔗 查看现有用户角色分配...');
    const existingRolesResult = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          string_agg(r.name, ', ') as roles
      FROM users_profile up
      LEFT JOIN user_roles ur ON up.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE up.status = 'active'
      GROUP BY up.id, up.nickname, up.email
      ORDER BY up.nickname
    `);
    
    if (existingRolesResult.success) {
      console.log('   当前用户角色分配:');
      existingRolesResult.data.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email || '无邮箱'}): ${user.roles || '无角色'}`);
      });
    }
    
    // 5. 为特定用户分配角色
    console.log('\n🔧 为用户分配角色...');
    
    // 为有邮箱的用户分配角色
    const usersWithEmail = usersResult.data.filter(user => user.email);
    
    for (const user of usersWithEmail) {
      let roleToAssign = 'user'; // 默认分配user角色
      
      // 根据用户信息或组织信息决定角色
      if (user.nickname.includes('李士军') || user.organization_name?.includes('北虹桥')) {
        roleToAssign = 'manager'; // 李士军作为部门经理
        console.log(`   📧 为 ${user.nickname} (${user.email}) 分配 manager 角色`);
      } else if (user.nickname.includes('周玲馨')) {
        roleToAssign = 'admin'; // 周玲馨作为系统管理员
        console.log(`   📧 为 ${user.nickname} (${user.email}) 分配 admin 角色`);
      } else {
        console.log(`   📧 为 ${user.nickname} (${user.email}) 分配 user 角色`);
      }
      
      const assignResult = await assignRoleToUser(user.email, roleToAssign);
      if (assignResult.success) {
        console.log(`   ✅ 角色分配成功`);
      } else {
        console.log(`   ❌ 角色分配失败: ${assignResult.error}`);
      }
    }
    
    // 6. 为没有邮箱的用户创建默认角色分配
    console.log('\n🔧 为无邮箱用户分配默认角色...');
    const usersWithoutEmail = usersResult.data.filter(user => !user.email);
    
    for (const user of usersWithoutEmail) {
      let roleToAssign = 'user'; // 默认分配user角色
      
      // 根据用户信息决定角色
      if (user.nickname.includes('李士军')) {
        roleToAssign = 'manager';
        console.log(`   👤 为 ${user.nickname} 分配 manager 角色 (无邮箱)`);
      } else {
        console.log(`   👤 为 ${user.nickname} 分配 user 角色 (无邮箱)`);
      }
      
      // 为无邮箱用户分配角色（通过用户ID）
      const assignQuery = `
        INSERT INTO user_roles (user_id, role_id)
        SELECT 
            up.user_id,
            r.id
        FROM users_profile up
        CROSS JOIN roles r
        WHERE up.nickname = $1
            AND r.name = $2
        ON CONFLICT (user_id, role_id) DO NOTHING;
      `;
      
      const assignResult = await executeQuery(assignQuery, [user.nickname, roleToAssign]);
      if (assignResult.success) {
        console.log(`   ✅ 角色分配成功`);
      } else {
        console.log(`   ❌ 角色分配失败: ${assignResult.error}`);
      }
    }
    
    // 7. 验证最终结果
    console.log('\n📊 验证最终分配结果...');
    const finalResult = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          string_agg(r.name, ', ') as roles
      FROM users_profile up
      LEFT JOIN user_roles ur ON up.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE up.status = 'active'
      GROUP BY up.id, up.nickname, up.email
      ORDER BY up.nickname
    `);
    
    if (finalResult.success) {
      console.log('\n👥 最终用户角色分配:');
      finalResult.data.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email || '无邮箱'}): ${user.roles || '无角色'}`);
      });
    }
    
    // 8. 显示统计信息
    console.log('\n📈 分配统计:');
    const statsResult = await executeQuery(`
      SELECT 
          r.name as role_name,
          COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN users_profile up ON ur.user_id = up.user_id AND up.status = 'active'
      GROUP BY r.id, r.name
      ORDER BY r.name
    `);
    
    if (statsResult.success) {
      console.log('   角色分配统计:');
      statsResult.data.forEach(stat => {
        console.log(`   - ${stat.role_name}: ${stat.user_count} 个用户`);
      });
    }
    
    console.log('\n✅ 用户角色分配完成！');
    console.log('\n📋 分配结果:');
    console.log('- admin角色: 系统管理员，拥有所有权限');
    console.log('- manager角色: 部门经理，可以管理指定部门');
    console.log('- user角色: 普通用户，基础功能权限');
    
  } catch (error) {
    console.error('❌ 分配过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行分配
if (import.meta.url === `file://${process.argv[1]}`) {
  assignRolesToExistingUsers();
}

export { assignRolesToExistingUsers }; 