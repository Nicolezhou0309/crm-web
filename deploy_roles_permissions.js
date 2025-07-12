import { connectDB, executeQuery, executeSQLFile, closeConnection } from './db-connect.js';
import fs from 'fs';

// 读取SQL文件内容
function readSQLFile(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (error) {
    console.error(`❌ 读取文件失败: ${filename}`, error.message);
    return null;
  }
}

// 执行SQL语句并显示结果
async function executeSQLWithLog(query, description) {
  console.log(`\n🔧 ${description}...`);
  const result = await executeQuery(query);
  
  if (result.success) {
    console.log(`✅ ${description}成功`);
    if (result.data && result.data.length > 0) {
      console.log(`📊 返回 ${result.data.length} 条记录`);
      // 显示前几条记录作为示例
      const displayCount = Math.min(3, result.data.length);
      for (let i = 0; i < displayCount; i++) {
        console.log(`   ${i + 1}. ${JSON.stringify(result.data[i])}`);
      }
      if (result.data.length > displayCount) {
        console.log(`   ... 还有 ${result.data.length - displayCount} 条记录`);
      }
    }
  } else {
    console.log(`❌ ${description}失败: ${result.error}`);
  }
  
  return result;
}

// 主部署函数
async function deployRolesAndPermissions() {
  console.log('🚀 开始部署基础角色和权限系统...');
  
  try {
    // 1. 连接数据库
    console.log('\n🔗 连接数据库...');
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败，退出部署');
      return;
    }
    
    // 2. 检查现有数据
    console.log('\n📋 检查现有数据...');
    
    // 检查角色表
    const rolesCheck = await executeQuery('SELECT COUNT(*) as count FROM roles');
    console.log(`   角色表: ${rolesCheck.success ? rolesCheck.data[0].count : '查询失败'} 条记录`);
    
    // 检查权限表
    const permissionsCheck = await executeQuery('SELECT COUNT(*) as count FROM permissions');
    console.log(`   权限表: ${permissionsCheck.success ? permissionsCheck.data[0].count : '查询失败'} 条记录`);
    
    // 检查角色权限关联表
    const rolePermissionsCheck = await executeQuery('SELECT COUNT(*) as count FROM role_permissions');
    console.log(`   角色权限关联表: ${rolePermissionsCheck.success ? rolePermissionsCheck.data[0].count : '查询失败'} 条记录`);
    
    // 3. 部署基础角色
    console.log('\n👥 部署基础角色...');
    
    const insertRoles = `
      INSERT INTO roles (name, description) VALUES
      ('admin', '系统管理员 - 拥有所有权限'),
      ('manager', '部门经理 - 可以管理指定部门'),
      ('user', '普通用户 - 基础功能权限')
      ON CONFLICT (name) DO NOTHING;
    `;
    
    await executeSQLWithLog(insertRoles, '插入基础角色');
    
    // 4. 部署基础权限
    console.log('\n🔐 部署基础权限...');
    
    const insertPermissions = `
      -- 线索管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('lead_view', 'lead', 'view', '查看线索'),
      ('lead_create', 'lead', 'create', '创建线索'),
      ('lead_edit', 'lead', 'edit', '编辑线索'),
      ('lead_delete', 'lead', 'delete', '删除线索'),
      ('lead_manage', 'lead', 'manage', '管理线索（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 跟进记录权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('followup_view', 'followup', 'view', '查看跟进记录'),
      ('followup_create', 'followup', 'create', '创建跟进记录'),
      ('followup_edit', 'followup', 'edit', '编辑跟进记录'),
      ('followup_delete', 'followup', 'delete', '删除跟进记录'),
      ('followup_manage', 'followup', 'manage', '管理跟进记录（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 成交管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('deal_view', 'deal', 'view', '查看成交记录'),
      ('deal_create', 'deal', 'create', '创建成交记录'),
      ('deal_edit', 'deal', 'edit', '编辑成交记录'),
      ('deal_delete', 'deal', 'delete', '删除成交记录'),
      ('deal_manage', 'deal', 'manage', '管理成交记录（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 部门管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('department_view', 'department', 'view', '查看部门信息'),
      ('department_create', 'department', 'create', '创建部门'),
      ('department_edit', 'department', 'edit', '编辑部门'),
      ('department_delete', 'department', 'delete', '删除部门'),
      ('department_manage', 'department', 'manage', '管理部门（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 用户管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('user_view', 'user', 'view', '查看用户信息'),
      ('user_create', 'user', 'create', '创建用户'),
      ('user_edit', 'user', 'edit', '编辑用户'),
      ('user_delete', 'user', 'delete', '删除用户'),
      ('user_manage', 'user', 'manage', '管理用户（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 角色权限管理
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('role_view', 'role', 'view', '查看角色'),
      ('role_create', 'role', 'create', '创建角色'),
      ('role_edit', 'role', 'edit', '编辑角色'),
      ('role_delete', 'role', 'delete', '删除角色'),
      ('role_manage', 'role', 'manage', '管理角色（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 权限管理
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('permission_view', 'permission', 'view', '查看权限'),
      ('permission_assign', 'permission', 'assign', '分配权限'),
      ('permission_manage', 'permission', 'manage', '管理权限（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 分配管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('allocation_view', 'allocation', 'view', '查看分配规则'),
      ('allocation_create', 'allocation', 'create', '创建分配规则'),
      ('allocation_edit', 'allocation', 'edit', '编辑分配规则'),
      ('allocation_delete', 'allocation', 'delete', '删除分配规则'),
      ('allocation_manage', 'allocation', 'manage', '管理分配规则（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 报表查看权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('report_view', 'report', 'view', '查看报表'),
      ('report_export', 'report', 'export', '导出报表'),
      ('report_manage', 'report', 'manage', '管理报表（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
      
      -- 积分管理权限
      INSERT INTO permissions (name, resource, action, description) VALUES
      ('points_view', 'points', 'view', '查看积分'),
      ('points_award', 'points', 'award', '奖励积分'),
      ('points_deduct', 'points', 'deduct', '扣除积分'),
      ('points_manage', 'points', 'manage', '管理积分（包含所有操作）')
      ON CONFLICT (resource, action) DO NOTHING;
    `;
    
    await executeSQLWithLog(insertPermissions, '插入基础权限');
    
    // 5. 为角色分配权限
    console.log('\n🔗 为角色分配权限...');
    
    const assignAdminPermissions = `
      -- 为admin角色分配所有权限
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 
          r.id as role_id,
          p.id as permission_id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name = 'admin'
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `;
    
    await executeSQLWithLog(assignAdminPermissions, '为admin角色分配所有权限');
    
    const assignManagerPermissions = `
      -- 为manager角色分配管理权限
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 
          r.id as role_id,
          p.id as permission_id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name = 'manager'
          AND p.name IN (
              'lead_view', 'lead_create', 'lead_edit', 'lead_manage',
              'followup_view', 'followup_create', 'followup_edit', 'followup_manage',
              'deal_view', 'deal_create', 'deal_edit', 'deal_manage',
              'department_view', 'department_create', 'department_edit',
              'user_view', 'user_edit',
              'allocation_view', 'allocation_create', 'allocation_edit',
              'report_view',
              'points_view', 'points_award'
          )
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `;
    
    await executeSQLWithLog(assignManagerPermissions, '为manager角色分配管理权限');
    
    const assignUserPermissions = `
      -- 为user角色分配基础权限
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 
          r.id as role_id,
          p.id as permission_id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name = 'user'
          AND p.name IN (
              'lead_view', 'lead_create', 'lead_edit',
              'followup_view', 'followup_create', 'followup_edit',
              'deal_view', 'deal_create', 'deal_edit',
              'department_view',
              'report_view',
              'points_view'
          )
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `;
    
    await executeSQLWithLog(assignUserPermissions, '为user角色分配基础权限');
    
    // 6. 验证部署结果
    console.log('\n📊 验证部署结果...');
    
    // 显示角色数据
    const rolesResult = await executeQuery('SELECT id, name, description, created_at FROM roles ORDER BY name');
    if (rolesResult.success) {
      console.log('\n👥 角色数据:');
      rolesResult.data.forEach(role => {
        console.log(`   - ${role.name}: ${role.description}`);
      });
    }
    
    // 显示权限统计
    const permissionsResult = await executeQuery('SELECT resource, COUNT(*) as count FROM permissions GROUP BY resource ORDER BY resource');
    if (permissionsResult.success) {
      console.log('\n🔐 权限统计:');
      permissionsResult.data.forEach(perm => {
        console.log(`   - ${perm.resource}: ${perm.count} 个权限`);
      });
    }
    
    // 显示角色权限分配统计
    const rolePermissionsResult = await executeQuery(`
      SELECT 
          r.name as role_name,
          COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name
      ORDER BY r.name
    `);
    
    if (rolePermissionsResult.success) {
      console.log('\n🔗 角色权限分配:');
      rolePermissionsResult.data.forEach(role => {
        console.log(`   - ${role.role_name}: ${role.permission_count} 个权限`);
      });
    }
    
    // 7. 显示用户信息（可选）
    console.log('\n👤 查看现有用户...');
    const usersResult = await executeQuery(`
      SELECT 
          up.nickname,
          up.email,
          up.status,
          o.name as organization_name
      FROM users_profile up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.status = 'active'
      ORDER BY up.nickname
      LIMIT 10
    `);
    
    if (usersResult.success && usersResult.data.length > 0) {
      console.log('   活跃用户列表:');
      usersResult.data.forEach(user => {
        console.log(`   - ${user.nickname} (${user.email}) - ${user.organization_name || '未分配部门'}`);
      });
    } else {
      console.log('   暂无活跃用户');
    }
    
    console.log('\n✅ 基础角色和权限系统部署完成！');
    console.log('\n📋 下一步操作:');
    console.log('1. 使用 assign_user_roles.sql 为用户分配角色');
    console.log('2. 测试前端权限控制功能');
    console.log('3. 根据需要调整权限配置');
    
  } catch (error) {
    console.error('❌ 部署过程中出现错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 如果直接运行此文件，执行部署
if (import.meta.url === `file://${process.argv[1]}`) {
  deployRolesAndPermissions();
}

export { deployRolesAndPermissions }; 