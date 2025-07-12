import { connectDB, executeQuery, closeConnection } from './db-connect.js';

// 主函数
async function checkAndFixUsers() {
  console.log('🔍 检查并修复用户数据...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出检查');
      return;
    }
    
    // 2. 检查用户数据
    console.log('\n📋 检查用户数据...');
    const usersResult = await executeQuery(`
      SELECT 
          up.id,
          up.user_id,
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
        console.log(`   ${index + 1}. ${user.nickname} (${user.email || '无邮箱'}) - user_id: ${user.user_id || 'NULL'} - ${user.organization_name || '未分配部门'}`);
      });
    }
    
    // 3. 检查auth.users表
    console.log('\n🔐 检查auth.users表...');
    const authUsersResult = await executeQuery(`
      SELECT 
          id,
          email,
          created_at
      FROM auth.users
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (authUsersResult.success) {
      console.log(`   找到 ${authUsersResult.data.length} 个auth用户:`);
      authUsersResult.data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} - ID: ${user.id} - 创建时间: ${user.created_at}`);
      });
    }
    
    // 4. 检查没有user_id的用户
    console.log('\n⚠️ 检查没有user_id的用户...');
    const usersWithoutUserId = usersResult.data.filter(user => !user.user_id);
    
    if (usersWithoutUserId.length > 0) {
      console.log(`   发现 ${usersWithoutUserId.length} 个用户没有user_id:`);
      usersWithoutUserId.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email || '无邮箱'})`);
      });
      
      // 5. 尝试为这些用户创建auth.users记录
      console.log('\n🔧 尝试为无user_id的用户创建auth记录...');
      
      for (const user of usersWithoutUserId) {
        if (user.email) {
          // 如果有邮箱，尝试创建auth.users记录
          console.log(`   为 ${user.nickname} (${user.email}) 创建auth记录...`);
          
          // 注意：这里需要管理员权限来创建auth.users记录
          // 在实际环境中，可能需要通过Supabase Admin API来创建
          console.log(`   ⚠️ 需要管理员权限来创建auth.users记录`);
        } else {
          console.log(`   ⚠️ ${user.nickname} 没有邮箱，无法创建auth记录`);
        }
      }
    } else {
      console.log('   ✅ 所有用户都有user_id');
    }
    
    // 6. 显示用户角色分配状态
    console.log('\n🔗 显示用户角色分配状态...');
    const userRolesResult = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          up.user_id,
          string_agg(r.name, ', ') as roles
      FROM users_profile up
      LEFT JOIN user_roles ur ON up.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE up.status = 'active'
      GROUP BY up.id, up.nickname, up.email, up.user_id
      ORDER BY up.nickname
    `);
    
    if (userRolesResult.success) {
      console.log('   用户角色分配状态:');
      userRolesResult.data.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email || '无邮箱'}): ${user.roles || '无角色'} - user_id: ${user.user_id || 'NULL'}`);
      });
    }
    
    // 7. 提供解决方案
    console.log('\n💡 解决方案建议:');
    console.log('1. 对于有邮箱的用户，需要创建对应的auth.users记录');
    console.log('2. 对于没有邮箱的用户，需要先设置邮箱或创建auth记录');
    console.log('3. 可以通过Supabase Admin API或手动在Supabase Dashboard中创建用户');
    console.log('4. 或者为这些用户设置临时邮箱地址');
    
    // 8. 显示可以分配角色的用户
    console.log('\n✅ 可以分配角色的用户:');
    const usersWithUserId = usersResult.data.filter(user => user.user_id);
    if (usersWithUserId.length > 0) {
      usersWithUserId.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email || '无邮箱'}) - user_id: ${user.user_id}`);
      });
    } else {
      console.log('   ⚠️ 没有找到有user_id的用户');
    }
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  checkAndFixUsers();
}

export { checkAndFixUsers }; 