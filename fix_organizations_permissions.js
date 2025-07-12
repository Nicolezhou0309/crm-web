import { connectDB, executeQuery, closeConnection } from './db-connect.js';

// 主函数
async function fixOrganizationsPermissions() {
  console.log('🔧 修复organizations表权限问题...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出修复');
      return;
    }
    
    // 2. 检查当前organizations表的RLS策略
    console.log('\n🔒 检查当前organizations表的RLS策略...');
    
    const currentPoliciesResult = await executeQuery(`
      SELECT 
          policyname,
          cmd,
          qual,
          with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
          AND tablename = 'organizations'
      ORDER BY policyname
    `);
    
    if (currentPoliciesResult.success) {
      console.log('📋 当前organizations表策略:');
      currentPoliciesResult.data.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd}`);
        console.log(`     条件: ${policy.qual || '无'}`);
        console.log(`     检查: ${policy.with_check || '无'}`);
      });
    }
    
    // 3. 删除现有的限制性策略
    console.log('\n🗑️ 删除现有的限制性策略...');
    
    const dropPolicies = [
      'DROP POLICY IF EXISTS "organizations_select_policy" ON "public"."organizations',
      'DROP POLICY IF EXISTS "organizations_insert_policy" ON "public"."organizations',
      'DROP POLICY IF EXISTS "organizations_update_policy" ON "public"."organizations',
      'DROP POLICY IF EXISTS "organizations_delete_policy" ON "public"."organizations'
    ];
    
    for (const dropPolicy of dropPolicies) {
      const result = await executeQuery(dropPolicy);
      if (result.success) {
        console.log(`   ✅ 删除策略成功`);
      } else {
        console.log(`   ⚠️ 删除策略失败: ${result.error}`);
      }
    }
    
    // 4. 创建新的权限策略
    console.log('\n🔧 创建新的权限策略...');
    
    // 创建SELECT策略 - 允许所有用户查看组织
    const createSelectPolicy = `
      CREATE POLICY "organizations_select_policy" ON "public"."organizations"
      FOR SELECT TO public
      USING (true)
    `;
    
    const selectResult = await executeQuery(createSelectPolicy);
    if (selectResult.success) {
      console.log('   ✅ SELECT策略创建成功');
    } else {
      console.log('   ❌ SELECT策略创建失败:', selectResult.error);
    }
    
    // 创建INSERT策略 - 允许管理员创建组织
    const createInsertPolicy = `
      CREATE POLICY "organizations_insert_policy" ON "public"."organizations"
      FOR INSERT TO public
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'manager')
        )
        OR
        EXISTS (
          SELECT 1 FROM organizations
          WHERE admin = auth.uid()
        )
      )
    `;
    
    const insertResult = await executeQuery(createInsertPolicy);
    if (insertResult.success) {
      console.log('   ✅ INSERT策略创建成功');
    } else {
      console.log('   ❌ INSERT策略创建失败:', insertResult.error);
    }
    
    // 创建UPDATE策略 - 允许管理员更新组织
    const createUpdatePolicy = `
      CREATE POLICY "organizations_update_policy" ON "public"."organizations"
      FOR UPDATE TO public
      USING (
        admin = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
            AND r.name = 'admin'
        )
      )
      WITH CHECK (
        admin = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
            AND r.name = 'admin'
        )
      )
    `;
    
    const updateResult = await executeQuery(createUpdatePolicy);
    if (updateResult.success) {
      console.log('   ✅ UPDATE策略创建成功');
    } else {
      console.log('   ❌ UPDATE策略创建失败:', updateResult.error);
    }
    
    // 创建DELETE策略 - 只允许admin角色删除组织
    const createDeletePolicy = `
      CREATE POLICY "organizations_delete_policy" ON "public"."organizations"
      FOR DELETE TO public
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
            AND r.name = 'admin'
        )
      )
    `;
    
    const deleteResult = await executeQuery(createDeletePolicy);
    if (deleteResult.success) {
      console.log('   ✅ DELETE策略创建成功');
    } else {
      console.log('   ❌ DELETE策略创建失败:', deleteResult.error);
    }
    
    // 5. 验证策略创建结果
    console.log('\n📊 验证策略创建结果...');
    
    const verifyPoliciesResult = await executeQuery(`
      SELECT 
          policyname,
          cmd,
          qual,
          with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
          AND tablename = 'organizations'
      ORDER BY policyname
    `);
    
    if (verifyPoliciesResult.success) {
      console.log('📋 修复后的organizations表策略:');
      verifyPoliciesResult.data.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd}`);
      });
    }
    
    // 6. 测试权限
    console.log('\n🧪 测试权限...');
    
    // 测试SELECT权限
    const testSelectResult = await executeQuery(`
      SELECT COUNT(*) as count FROM organizations
    `);
    
    if (testSelectResult.success) {
      console.log('   ✅ SELECT权限测试成功');
      console.log(`   组织数量: ${testSelectResult.data[0].count}`);
    } else {
      console.log('   ❌ SELECT权限测试失败:', testSelectResult.error);
    }
    
    // 测试INSERT权限（模拟）
    console.log('   📝 INSERT权限需要在实际操作中测试');
    
    // 7. 检查周玲馨的权限状态
    console.log('\n👤 检查周玲馨的权限状态...');
    
    const userPermissionsResult = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          string_agg(r.name, ', ') as roles
      FROM users_profile up
      LEFT JOIN user_roles ur ON up.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE up.email = '537093913@qq.com'
      GROUP BY up.id, up.nickname, up.email
    `);
    
    if (userPermissionsResult.success && userPermissionsResult.data.length > 0) {
      const user = userPermissionsResult.data[0];
      console.log('   用户权限状态:', {
        nickname: user.nickname,
        email: user.email,
        roles: user.roles || '无角色'
      });
    }
    
    // 8. 检查organizations表的权限
    console.log('\n🔍 检查organizations表的权限...');
    
    const orgPermissionsResult = await executeQuery(`
      SELECT 
          has_table_privilege('public', 'organizations', 'INSERT') as can_insert,
          has_table_privilege('public', 'organizations', 'SELECT') as can_select,
          has_table_privilege('public', 'organizations', 'UPDATE') as can_update,
          has_table_privilege('public', 'organizations', 'DELETE') as can_delete
    `);
    
    if (orgPermissionsResult.success && orgPermissionsResult.data.length > 0) {
      const permissions = orgPermissionsResult.data[0];
      console.log('   organizations表权限:', {
        INSERT: permissions.can_insert,
        SELECT: permissions.can_select,
        UPDATE: permissions.can_update,
        DELETE: permissions.can_delete
      });
    }
    
    console.log('\n✅ organizations表权限修复完成！');
    console.log('\n📋 修复内容:');
    console.log('1. 删除了限制性的RLS策略');
    console.log('2. 创建了基于角色的权限策略');
    console.log('3. 允许admin和manager角色创建组织');
    console.log('4. 允许组织管理员更新自己的组织');
    console.log('5. 只允许admin角色删除组织');
    console.log('\n🎯 现在周玲馨应该能够新增部门了！');
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行修复
if (import.meta.url === `file://${process.argv[1]}`) {
  fixOrganizationsPermissions();
}

export { fixOrganizationsPermissions }; 