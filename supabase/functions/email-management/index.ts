import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 递归获取所有可管理的部门ID（含自己和所有子部门）
async function getAllManageableOrgIds(adminClient, rootOrgId) {
  const result = [rootOrgId];
  
  async function findChildren(parentId) {
    const { data: children } = await adminClient
      .from('organizations')
      .select('id')
      .eq('parent_id', parentId);
      
    if (children && children.length > 0) {
      for (const child of children) {
        result.push(child.id);
        await findChildren(child.id);
      }
    }
  }
  
  await findChildren(rootOrgId);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    console.log('收到请求:', req.method, req.url);
    
    // 解析请求体
    const body = await req.json();
    console.log('请求体:', body);
    
    const { 
      action, 
      email: rawEmail, 
      newEmail: rawNewEmail, 
      userId, 
      organizationId // 组织ID（用于权限验证）
    } = body;
    
    // 清理邮箱地址，去除换行符和空格
    const email = rawEmail ? rawEmail.toString().trim().replace(/\n/g, '') : undefined;
    const newEmail = rawNewEmail ? rawNewEmail.toString().trim().replace(/\n/g, '') : undefined;
    
    console.log('解析参数:', {
      action,
      email,
      newEmail,
      userId,
      organizationId
    });
    
    // 验证必要参数
    if (!action) {
      console.log('缺少操作类型');
      return new Response(JSON.stringify({
        error: '缺少操作类型'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    
    if (!authHeader) {
      console.log('缺少Authorization header');
      return new Response(JSON.stringify({
        error: '未授权',
        details: '缺少Authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 创建带有请求者身份的客户端
    console.log('Creating userClient with auth header');
    const userClient = createClient(
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
    
    // 创建服务端客户端（具有管理员权限）
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    // 验证请求者是否已登录
    console.log('验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('用户验证结果:', {
      user: requestUser?.user?.id,
      error: authError
    });
    
    if (authError || !requestUser?.user) {
      console.log('用户未授权:', authError);
      return new Response(JSON.stringify({
        error: '未授权',
        details: authError?.message || '无有效用户会话',
        authError: authError
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('用户已授权:', requestUser.user.id);
    
    // 验证请求者是否有权限管理该组织
    if (organizationId) {
      console.log('验证组织权限:', organizationId);
      
      // 首先检查是否为超级管理员
      const { data: { session } } = await userClient.auth.getSession();
      const isSuperAdmin = session?.access_token ? 
        JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
      
      if (isSuperAdmin) {
        console.log('用户是超级管理员，权限验证通过');
      } else {
        // 检查是否为直接管理员
        const { data: orgs, error: orgsError } = await userClient
          .from('organizations')
          .select('id')
          .eq('admin', requestUser.user.id)
          .eq('id', organizationId);
          
        console.log('组织权限检查结果:', {
          orgs,
          error: orgsError
        });
        
        if (orgsError) {
          console.log('验证权限失败:', orgsError);
          return new Response(JSON.stringify({
            error: '验证权限失败',
            details: orgsError
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        
        if (!orgs || orgs.length === 0) {
          console.log('用户不是直接管理员，检查递归权限...');
          
          // 递归检查是否通过父部门管理
          const checkRecursivePermission = async (orgId) => {
            const { data: org } = await userClient
              .from('organizations')
              .select('id, parent_id, admin')
              .eq('id', orgId)
              .single();
              
            if (!org) return false;
            
            // 如果当前部门的管理员是当前用户，返回true
            if (org.admin === requestUser.user.id) return true;
            
            // 如果有父部门，递归检查父部门
            if (org.parent_id) {
              return await checkRecursivePermission(org.parent_id);
            }
            
            return false;
          };
          
          const hasPermission = await checkRecursivePermission(organizationId);
          console.log('递归权限检查结果:', hasPermission);
          
          if (!hasPermission) {
            console.log('无权管理此组织');
            return new Response(JSON.stringify({
              error: '无权管理此组织'
            }), {
              status: 403,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        }
      }
    }
    
    console.log('权限验证通过，开始执行操作:', action);
    
    // 验证操作特定的参数
    if (action === 'reset_email') {
      if (!newEmail) {
        console.log('[reset_email] 缺少新邮箱地址');
        return new Response(JSON.stringify({
          error: '缺少新邮箱地址'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (!userId && !email) {
        console.log('[reset_email] 缺少用户ID或原邮箱地址');
        return new Response(JSON.stringify({
          error: '缺少用户ID或原邮箱地址'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // 根据操作类型执行相应的操作
    let result;
    let targetUser = null;
    let targetEmail = null;
    
    switch(action) {
      case 'send_verification':
        console.log('[send_verification] 入口:', {
          userId,
          email,
          organizationId
        });
        
        try {
          if (!userId && !email) {
            console.log('[send_verification] 缺少用户ID或邮箱地址');
            return new Response(JSON.stringify({
              error: '缺少用户ID或邮箱地址'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          if (userId) {
            // 已注册用户
            console.log('处理已注册用户:', userId);
            const { data: user, error: userError } = await adminClient.auth.admin.getUserById(userId);
            console.log('getUserById结果:', {
              user,
              userError
            });
            
            if (userError || !user) {
              return new Response(JSON.stringify({
                error: '用户不存在',
                details: userError
              }), {
                status: 404,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            
            targetUser = user;
            targetEmail = user.user.email;
            
            // 验证用户是否属于指定组织
            if (organizationId) {
              const { data: profile, error: profileError } = await adminClient
                .from('users_profile')
                .select('organization_id')
                .eq('user_id', userId)
                .single();
                
              if (profileError) {
                return new Response(JSON.stringify({
                  error: '获取用户资料失败',
                  details: profileError
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              
              if (profile.organization_id !== organizationId) {
                return new Response(JSON.stringify({
                  error: '用户不属于指定组织'
                }), {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            }
            
            // 递归获取所有可管理的部门ID（含自己和所有子部门）
            const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
            if (!manageableOrgIds.includes(user.organization_id)) {
              console.log(`[send_verification] 无权管理该成员所属组织`, {
                organizationId,
                memberOrg: user.organization_id
              });
              return new Response(JSON.stringify({
                error: '无权管理该成员所属组织'
              }), {
                status: 403,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            
            // 发送验证邮件 - 使用inviteUser方法替代generateLink
            try {
              result = await adminClient.auth.admin.inviteUserByEmail(user.user.email, {
                data: {
                  organization_id: organizationId || null
                }
              });
              console.log('inviteUserByEmail结果:', result);
              
              if (result.error) {
                return new Response(JSON.stringify({
                  error: 'inviteUserByEmail失败',
                  details: result.error
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            } catch (inviteError) {
              console.log('inviteUserByEmail异常:', inviteError);
              
              // 如果inviteUserByEmail失败，尝试使用generateLink
              try {
                result = await adminClient.auth.admin.generateLink({
                  type: 'signup',
                  email: user.user.email
                });
                console.log('generateLink结果:', result);
                
                if (result.error) {
                  return new Response(JSON.stringify({
                    error: 'generateLink失败',
                    details: result.error
                  }), {
                    status: 500,
                    headers: {
                      ...corsHeaders,
                      'Content-Type': 'application/json'
                    }
                  });
                }
              } catch (generateError) {
                console.log('generateLink异常:', generateError);
                return new Response(JSON.stringify({
                  error: '发送验证邮件失败',
                  details: generateError.message || String(generateError)
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            }
            
            return new Response(JSON.stringify({
              success: true,
              message: '验证/邀请邮件已发送',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // 查 profile
            const { data: profile } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('email', email)
              .single();
              
            console.log('[send_verification] profile:', profile);
            
            if (!profile) {
              console.log('[send_verification] profile not found, email:', email);
              return new Response(JSON.stringify({
                error: '用户不存在或未注册，无法发送验证邮件'
              }), {
                status: 404,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else if (profile.status === 'invited') {
              console.log('[send_verification] status=invited, 发送注册邀请:', email);
              result = await adminClient.auth.admin.generateLink({
                type: 'signup',
                email,
                options: {
                  data: {
                    organization_id: organizationId || null
                  }
                }
              });
              console.log('[send_verification] generateLink结果:', result);
              
              return new Response(JSON.stringify({
                success: true,
                message: '验证邮件已重新发送',
                data: result.data
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else if (profile.status === 'active') {
              console.log('[send_verification] status=active, 已注册已验证:', email);
              return new Response(JSON.stringify({
                error: '该用户已注册并验证，无需重复邀请'
              }), {
                status: 409,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else {
              console.log('[send_verification] 其它状态:', profile.status, email);
              return new Response(JSON.stringify({
                error: '当前用户状态不支持重新发送验证邮件'
              }), {
                status: 400,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
        } catch (e) {
          console.log('[send_verification] 异常:', e);
          return new Response(JSON.stringify({
            error: 'send_verification分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      case 'reset_email':
        console.log('[reset_email] 入口:', {
          userId,
          email,
          newEmail,
          organizationId
        });
        
        try {
          // 查 profile - 支持通过userId或email查找
          let profile;
          if (userId) {
            // 已注册用户，通过userId查找
            const { data: profileData } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('user_id', userId)
              .single();
            profile = profileData;
          } else if (email) {
            // 未注册用户，通过email查找
            const { data: profileData } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('email', email)
              .single();
            profile = profileData;
          }
          
          console.log('[reset_email] profile:', profile);
          
          if (!profile) {
            console.log('[reset_email] profile not found, userId:', userId, 'email:', email);
            return new Response(JSON.stringify({
              error: '用户不存在，无法重置邮箱'
            }), {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          // 递归校验组织管理权
          if (organizationId && profile.organization_id) {
            console.log('[reset_email] 开始权限验证:', {
              organizationId,
              memberOrg: profile.organization_id
            });
            
            // 检查是否为超级管理员
            const { data: { session } } = await userClient.auth.getSession();
            const isSuperAdmin = session?.access_token ? 
              JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
              
            if (isSuperAdmin) {
              console.log('[reset_email] 超级管理员，权限验证通过');
            } else {
              const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
              console.log('[reset_email] 可管理的组织ID列表:', manageableOrgIds);
              
              if (!manageableOrgIds.includes(profile.organization_id)) {
                console.log('[reset_email] 无权管理该成员所属组织', {
                  organizationId,
                  memberOrg: profile.organization_id,
                  manageableOrgIds
                });
                return new Response(JSON.stringify({
                  error: '无权管理该成员所属组织'
                }), {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              console.log('[reset_email] 权限验证通过');
            }
          } else {
            console.log('[reset_email] 跳过权限验证 - organizationId或profile.organization_id为空');
          }
          
          if (profile.status === 'invited' && !profile.user_id) {
            // 未注册用户
            console.log('[reset_email] 未注册用户，直接修改user_profiles邮箱并发送注册邀请:', newEmail);
            await adminClient
              .from('users_profile')
              .update({ email: newEmail })
              .eq('id', profile.id);
              
            result = await adminClient.auth.admin.generateLink({
              type: 'signup',
              email: newEmail,
              options: {
                data: {
                  organization_id: organizationId || null
                }
              }
            });
            
            return new Response(JSON.stringify({
              success: true,
              message: '邮箱已重置并发送注册邀请',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else if (profile.status === 'active' || profile.status === 'invited' && profile.user_id) {
            // 已注册用户
            console.log('[reset_email] status允许重置:', profile.status, profile.user_id, newEmail);
            result = await adminClient.auth.admin.updateUserById(profile.user_id, {
              email: newEmail,
              email_confirmed_at: null
            });
            
            await adminClient
              .from('users_profile')
              .update({ email: newEmail })
              .eq('user_id', profile.user_id);
              
            await adminClient.auth.admin.generateLink({
              type: 'signup',
              email: newEmail,
              options: {
                data: {
                  organization_id: organizationId || null
                }
              }
            });
            
            console.log('[reset_email] 邮箱已重置并发送验证邮件:', newEmail);
            return new Response(JSON.stringify({
              success: true,
              message: '邮箱已重置并发送验证邮件',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // 其它情况
            console.log('[reset_email] 当前用户状态不支持重置邮箱:', profile.status, userId);
            return new Response(JSON.stringify({
              error: '当前用户状态不支持重置邮箱'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        } catch (e) {
          console.log('[reset_email] 异常:', e);
          return new Response(JSON.stringify({
            error: 'reset_email分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      case 'send_password_reset':
        console.log('[send_password_reset] 入口:', {
          userId,
          email,
          organizationId
        });
        
        try {
          // 查 profile
          const { data: profile } = await adminClient
            .from('users_profile')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          console.log('[send_password_reset] profile:', profile);
          
          if (!profile) {
            console.log('[send_password_reset] profile not found, userId:', userId);
            return new Response(JSON.stringify({
              error: '用户不存在，无法发送密码重置'
            }), {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          // 递归校验组织管理权
          if (organizationId) {
            const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
            if (!manageableOrgIds.includes(profile.organization_id)) {
              console.log('[send_password_reset] 无权管理该成员所属组织', {
                organizationId,
                memberOrg: profile.organization_id
              });
              return new Response(JSON.stringify({
                error: '无权管理该成员所属组织'
              }), {
                status: 403,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
          
          // 发送密码重置链接
          result = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: profile.email
          });
          
          console.log('[send_password_reset] 密码重置链接已发送:', profile.email);
          return new Response(JSON.stringify({
            success: true,
            message: '密码重置链接已发送',
            data: result.data
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (e) {
          console.log('[send_password_reset] 异常:', e);
          return new Response(JSON.stringify({
            error: 'send_password_reset分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      default:
        return new Response(JSON.stringify({
          error: '不支持的操作类型'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
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
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}); 