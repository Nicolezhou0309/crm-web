import { connectDB, executeQuery, closeConnection } from './db-connect.js';

// 主函数
async function checkPermissionsFunctions() {
  console.log('🔍 检查权限函数和RLS策略...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出检查');
      return;
    }
    
    // 2. 检查权限相关函数
    console.log('\n🔧 检查权限相关函数...');
    
    // 检查get_user_roles函数
    const userRolesResult = await executeQuery(`
      SELECT 
          p.proname as function_name,
          pg_get_function_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
          AND p.proname = 'get_user_roles'
    `);
    
    if (userRolesResult.success && userRolesResult.data.length > 0) {
      console.log('✅ get_user_roles函数存在');
      console.log('   函数信息:', userRolesResult.data[0]);
    } else {
      console.log('❌ get_user_roles函数不存在');
    }
    
    // 检查get_managed_org_ids函数
    const managedOrgsResult = await executeQuery(`
      SELECT 
          p.proname as function_name,
          pg_get_function_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
          AND p.proname = 'get_managed_org_ids'
    `);
    
    if (managedOrgsResult.success && managedOrgsResult.data.length > 0) {
      console.log('✅ get_managed_org_ids函数存在');
      console.log('   函数信息:', managedOrgsResult.data[0]);
    } else {
      console.log('❌ get_managed_org_ids函数不存在');
    }
    
    // 3. 检查RLS策略
    console.log('\n🔒 检查RLS策略...');
    
    const rlsPoliciesResult = await executeQuery(`
      SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
          AND tablename IN ('organizations', 'users_profile')
      ORDER BY tablename, policyname
    `);
    
    if (rlsPoliciesResult.success) {
      console.log('📋 RLS策略列表:');
      rlsPoliciesResult.data.forEach(policy => {
        console.log(`   - 表: ${policy.tablename}, 策略: ${policy.policyname}, 操作: ${policy.cmd}`);
      });
    }
    
    // 4. 检查organizations表的RLS状态
    const orgRlsResult = await executeQuery(`
      SELECT 
          schemaname,
          tablename,
          rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public' 
          AND tablename = 'organizations'
    `);
    
    if (orgRlsResult.success && orgRlsResult.data.length > 0) {
      console.log('📊 organizations表RLS状态:', orgRlsResult.data[0].rowsecurity);
    }
    
    // 5. 测试权限函数
    console.log('\n🧪 测试权限函数...');
    
    // 测试get_user_roles函数
    const testUserRolesResult = await executeQuery(`
      SELECT * FROM get_user_roles('af064f88-d423-4f9a-a60a-f32911826d2d')
    `);
    
    if (testUserRolesResult.success) {
      console.log('✅ get_user_roles函数测试成功');
      console.log('   返回结果:', testUserRolesResult.data);
    } else {
      console.log('❌ get_user_roles函数测试失败:', testUserRolesResult.error);
    }
    
    // 测试get_managed_org_ids函数
    const testManagedOrgsResult = await executeQuery(`
      SELECT * FROM get_managed_org_ids('af064f88-d423-4f9a-a60a-f32911826d2d')
    `);
    
    if (testManagedOrgsResult.success) {
      console.log('✅ get_managed_org_ids函数测试成功');
      console.log('   返回结果:', testManagedOrgsResult.data);
    } else {
      console.log('❌ get_managed_org_ids函数测试失败:', testManagedOrgsResult.error);
    }
    
    // 6. 检查周玲馨的权限状态
    console.log('\n👤 检查周玲馨的权限状态...');
    
    const userInfoResult = await executeQuery(`
      SELECT 
          up.id,
          up.user_id,
          up.nickname,
          up.email,
          up.status,
          o.name as organization_name,
          o.admin as org_admin
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.email = '537093913@qq.com'
    `);
    
    if (userInfoResult.success && userInfoResult.data.length > 0) {
      const user = userInfoResult.data[0];
      console.log('   用户信息:', {
        nickname: user.nickname,
        email: user.email,
        user_id: user.user_id,
        organization: user.organization_name,
        is_org_admin: user.org_admin === user.user_id
      });
    }
    
    // 7. 检查organizations表的插入权限
    console.log('\n🔍 检查organizations表的插入权限...');
    
    const orgInsertTestResult = await executeQuery(`
      SELECT 
          has_table_privilege('public', 'organizations', 'INSERT') as can_insert,
          has_table_privilege('public', 'organizations', 'SELECT') as can_select,
          has_table_privilege('public', 'organizations', 'UPDATE') as can_update,
          has_table_privilege('public', 'organizations', 'DELETE') as can_delete
    `);
    
    if (orgInsertTestResult.success && orgInsertTestResult.data.length > 0) {
      const permissions = orgInsertTestResult.data[0];
      console.log('   organizations表权限:', {
        INSERT: permissions.can_insert,
        SELECT: permissions.can_select,
        UPDATE: permissions.can_update,
        DELETE: permissions.can_delete
      });
    }
    
    // 8. 检查当前用户角色
    console.log('\n🎭 检查当前用户角色...');
    
    const currentUserRolesResult = await executeQuery(`
      SELECT 
          r.name as role_name,
          r.description as role_description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = 'af064f88-d423-4f9a-a60a-f32911826d2d'
    `);
    
    if (currentUserRolesResult.success) {
      console.log('   周玲馨的角色:');
      currentUserRolesResult.data.forEach(role => {
        console.log(`   - ${role.role_name}: ${role.role_description}`);
      });
    }
    
    // 9. 检查organizations表的数据
    console.log('\n📊 检查organizations表数据...');
    
    const orgsDataResult = await executeQuery(`
      SELECT 
          id,
          name,
          admin,
          parent_id
      FROM organizations
      ORDER BY name
    `);
    
    if (orgsDataResult.success) {
      console.log('   组织数据:');
      orgsDataResult.data.forEach(org => {
        console.log(`   - ${org.name} (ID: ${org.id}) - 管理员: ${org.admin || '无'} - 父级: ${org.parent_id || '无'}`);
      });
    }
    
    console.log('\n✅ 权限检查完成！');
    console.log('\n📋 问题诊断:');
    console.log('1. 如果权限函数不存在，需要创建它们');
    console.log('2. 如果RLS策略过于严格，需要调整');
    console.log('3. 如果用户角色不正确，需要重新分配');
    console.log('4. 如果organizations表权限不足，需要修改策略');
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  checkPermissionsFunctions();
}

export { checkPermissionsFunctions }; 