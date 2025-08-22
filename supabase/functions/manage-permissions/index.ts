import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  try {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 获取授权头
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 创建 Supabase 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_ANON_KEY'), 
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );
    
    // 解析请求体
    const { action, ...params } = await req.json();
    
    // 根据操作类型执行不同的操作
    switch(action) {
      case 'createRole':
        return await handleCreateRole(supabase, params);
      case 'createPermission':
        return await handleCreatePermission(supabase, params);
      case 'assignRoleToUser':
        return await handleAssignRoleToUser(supabase, params);
      case 'assignPermissionToRole':
        return await handleAssignPermissionToRole(supabase, params);
      case 'getUserRoles':
        return await handleGetUserRoles(supabase, params);
      case 'getUserPermissions':
        return await handleGetUserPermissions(supabase, params);
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// 创建角色
async function handleCreateRole(supabase, { name, description }) {
  if (!name) {
    return new Response(JSON.stringify({
      error: 'Missing role name'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('roles')
    .insert({ name, description })
    .select()
    .single();
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Role created successfully',
    role: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 创建权限
async function handleCreatePermission(supabase, { name, resource, action, description }) {
  if (!name || !resource || !action) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('permissions')
    .insert({ name, resource, action, description })
    .select()
    .single();
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Permission created successfully',
    permission: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 为用户分配角色
async function handleAssignRoleToUser(supabase, { userId, roleName }) {
  if (!userId || !roleName) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase.rpc('assign_role_to_user', {
    target_user_id: userId,
    role_name: roleName
  });
  
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Role assigned successfully',
    success: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 为角色分配权限
async function handleAssignPermissionToRole(supabase, { roleName, resource, action }) {
  if (!roleName || !resource || !action) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase.rpc('assign_permission_to_role', {
    role_name: roleName,
    resource_name: resource,
    action_name: action
  });
  
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Permission assigned successfully',
    success: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 获取用户角色
async function handleGetUserRoles(supabase, { userId }) {
  if (!userId) {
    return new Response(JSON.stringify({
      error: 'Missing user ID'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role:roles (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId);
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    roles: data.map((item) => item.role)
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 获取用户权限
async function handleGetUserPermissions(supabase, { userId }) {
  if (!userId) {
    return new Response(JSON.stringify({
      error: 'Missing user ID'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role_permissions!role_id (
        permission:permission_id (
          id,
          name,
          resource,
          action,
          description
        )
      )
    `)
    .eq('user_id', userId);
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // 提取权限并去重
  const permissions = [];
  const permissionIds = new Set();
  
  data.forEach((userRole) => {
    userRole.role_permissions.forEach((rp) => {
      if (rp.permission && !permissionIds.has(rp.permission.id)) {
        permissions.push(rp.permission);
        permissionIds.add(rp.permission.id);
      }
    });
  });
  
  return new Response(JSON.stringify({
    permissions
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
} 