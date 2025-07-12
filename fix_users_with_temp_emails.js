import { connectDB, executeQuery, closeConnection } from './db-connect.js';

// 主函数
async function fixUsersWithTempEmails() {
  console.log('🔧 为无user_id的用户设置临时邮箱...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出修复');
      return;
    }
    
    // 2. 检查没有user_id的用户
    console.log('\n📋 检查没有user_id的用户...');
    const usersWithoutUserId = await executeQuery(`
      SELECT 
          up.id,
          up.nickname,
          up.email,
          up.status,
          o.name as organization_name
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.status = 'active' AND up.user_id IS NULL
      ORDER BY up.nickname
    `);
    
    if (usersWithoutUserId.success && usersWithoutUserId.data.length > 0) {
      console.log(`   找到 ${usersWithoutUserId.data.length} 个没有user_id的用户:`);
      usersWithoutUserId.data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.nickname} (${user.email || '无邮箱'}) - ${user.organization_name || '未分配部门'}`);
      });
      
      // 3. 为这些用户设置临时邮箱
      console.log('\n📧 为无user_id的用户设置临时邮箱...');
      
      for (const user of usersWithoutUserId.data) {
        if (!user.email) {
          // 生成临时邮箱
          const tempEmail = `${user.nickname.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')}@temp.crm.com`;
          console.log(`   为 ${user.nickname} 设置临时邮箱: ${tempEmail}`);
          
          // 更新用户邮箱
          const updateResult = await executeQuery(`
            UPDATE users_profile 
            SET email = $1 
            WHERE id = $2
          `, [tempEmail, user.id]);
          
          if (updateResult.success) {
            console.log(`   ✅ 邮箱更新成功`);
          } else {
            console.log(`   ❌ 邮箱更新失败: ${updateResult.error}`);
          }
        }
      }
      
      // 4. 重新检查用户数据
      console.log('\n📋 重新检查用户数据...');
      const updatedUsersResult = await executeQuery(`
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
      
      if (updatedUsersResult.success) {
        console.log(`   更新后的用户数据:`);
        updatedUsersResult.data.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.nickname} (${user.email || '无邮箱'}) - user_id: ${user.user_id || 'NULL'} - ${user.organization_name || '未分配部门'}`);
        });
      }
      
      // 5. 显示需要手动创建auth记录的用户
      console.log('\n⚠️ 需要手动创建auth.users记录的用户:');
      const usersNeedingAuth = updatedUsersResult.data.filter(user => !user.user_id);
      
      if (usersNeedingAuth.length > 0) {
        console.log(`   以下 ${usersNeedingAuth.length} 个用户需要创建auth.users记录:`);
        usersNeedingAuth.forEach(user => {
          console.log(`   - ${user.nickname} (${user.email})`);
        });
        
        console.log('\n💡 手动创建auth.users记录的步骤:');
        console.log('1. 登录Supabase Dashboard');
        console.log('2. 进入 Authentication > Users');
        console.log('3. 点击 "Add User"');
        console.log('4. 为每个用户创建记录:');
        
        usersNeedingAuth.forEach(user => {
          console.log(`   - 邮箱: ${user.email}`);
          console.log(`   - 密码: 临时密码 (用户首次登录时需要重置)`);
        });
        
        console.log('\n📝 或者使用Supabase Admin API创建用户:');
        console.log('```javascript');
        console.log('const { createClient } = require("@supabase/supabase-js");');
        console.log('const supabase = createClient(url, service_role_key);');
        console.log('');
        usersNeedingAuth.forEach(user => {
          console.log(`// 创建用户: ${user.nickname}`);
          console.log(`await supabase.auth.admin.createUser({`);
          console.log(`  email: "${user.email}",`);
          console.log(`  password: "临时密码",`);
          console.log(`  email_confirm: true`);
          console.log(`});`);
          console.log('');
        });
        console.log('```');
      }
      
    } else {
      console.log('   ✅ 所有用户都有user_id，无需修复');
    }
    
    // 6. 显示当前可以分配角色的用户
    console.log('\n✅ 当前可以分配角色的用户:');
    const usersWithUserId = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          up.user_id,
          string_agg(r.name, ', ') as roles
      FROM users_profile up
      LEFT JOIN user_roles ur ON up.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE up.status = 'active' AND up.user_id IS NOT NULL
      GROUP BY up.id, up.nickname, up.email, up.user_id
      ORDER BY up.nickname
    `);
    
    if (usersWithUserId.success) {
      console.log('   有user_id的用户:');
      usersWithUserId.data.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email}): ${user.roles || '无角色'} - user_id: ${user.user_id}`);
      });
    }
    
    console.log('\n✅ 用户数据修复完成！');
    console.log('\n📋 下一步操作:');
    console.log('1. 手动创建auth.users记录（如上所示）');
    console.log('2. 运行 assign_existing_users.js 为用户分配角色');
    console.log('3. 测试前端权限控制功能');
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行修复
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUsersWithTempEmails();
}

export { fixUsersWithTempEmails }; 