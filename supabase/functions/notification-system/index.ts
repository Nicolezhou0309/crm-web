import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

interface Notification {
  id: string;
  user_id: number;
  type: string;
  title: string;
  content: string;
  metadata?: any;
  status: 'unread' | 'read' | 'handled';
  priority: number;
  expires_at?: string;
  created_at: string;
  read_at?: string;
  handled_at?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
  target_roles?: string[];
  target_organizations?: string[];
  is_active: boolean;
  start_time: string;
  end_time?: string;
  created_by?: number;
  created_at: string;
  is_read?: boolean;
}

// 辅助函数：获取用户的profile ID
async function getUserProfileId(supabase: any, user: any): Promise<number> {
  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('无法获取用户档案信息');
  }

  return profile.id;
}

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('收到通知系统请求:', req.method, req.url);
    
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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

    // 创建Supabase客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: '用户未授权',
        details: authError?.message
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (req.method) {
      case 'GET':
        return await handleGet(supabase, action, url.searchParams, user);
      case 'POST':
        return await handlePost(supabase, action, await req.json(), user);
      case 'PUT':
        return await handlePut(supabase, action, await req.json(), user);
      case 'DELETE':
        return await handleDelete(supabase, action, url.searchParams, user);
      default:
        return new Response(JSON.stringify({
          error: '不支持的HTTP方法'
        }), {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    console.error('处理请求时出错:', error);
    console.error('错误堆栈:', error.stack);
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// GET请求处理
async function handleGet(supabase: any, action: string | null, params: URLSearchParams, user: any) {
  switch (action) {
    case 'notifications':
      return await getNotifications(supabase, params, user);
    case 'announcements':
      return await getAnnouncements(supabase, params, user);
    case 'all_announcements':
      return await getAllAnnouncements(supabase, params, user);
    case 'stats':
      return await getNotificationStats(supabase, user);
    default:
      return new Response(JSON.stringify({
        error: '不支持的GET操作'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
  }
}

// POST请求处理
async function handlePost(supabase: any, action: string | null, body: any, user: any) {
  switch (action) {
    case 'create_notification':
      return await createNotification(supabase, body, user);
    case 'create_announcement':
      return await createAnnouncement(supabase, body, user);
    case 'mark_read':
      return await markNotificationRead(supabase, body, user);
    case 'mark_handled':
      return await markNotificationHandled(supabase, body, user);
    case 'mark_announcement_read':
      return await markAnnouncementRead(supabase, body, user);
    default:
      return new Response(JSON.stringify({
        error: '不支持的POST操作'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
  }
}

// PUT请求处理
async function handlePut(supabase: any, action: string | null, body: any, user: any) {
  switch (action) {
    case 'update_announcement':
      return await updateAnnouncement(supabase, body, user);
    default:
      return new Response(JSON.stringify({
        error: '不支持的PUT操作'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
  }
}

// DELETE请求处理
async function handleDelete(supabase: any, action: string | null, params: URLSearchParams, user: any) {
  switch (action) {
    case 'delete_notification':
      return await deleteNotification(supabase, params, user);
    case 'delete_announcement':
      return await deleteAnnouncement(supabase, params, user);
    default:
      return new Response(JSON.stringify({
        error: '不支持的DELETE操作'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
  }
}

// 获取用户通知
async function getNotifications(supabase: any, params: URLSearchParams, user: any) {
  const status = params.get('status');
  const limit = parseInt(params.get('limit') || '50');
  const offset = parseInt(params.get('offset') || '0');

  try {
    const profileId = await getUserProfileId(supabase, user);
    let query = supabase
      .rpc('get_user_notifications', { p_user_id: profileId })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({
        error: '获取通知失败',
        details: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: data || []
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '获取通知失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 获取用户公告
async function getAnnouncements(supabase: any, params: URLSearchParams, user: any) {
  const unreadOnly = params.get('unread_only') === 'true';

  try {
    const profileId = await getUserProfileId(supabase, user);
    const { data, error } = await supabase
      .rpc('get_user_announcements', { p_user_id: profileId });

    if (error) {
      return new Response(JSON.stringify({
        error: '获取公告失败',
        details: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    let filteredData = data || [];
    if (unreadOnly) {
      filteredData = filteredData.filter((announcement: Announcement) => !announcement.is_read);
    }

    return new Response(JSON.stringify({
      success: true,
      data: filteredData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '获取公告失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 获取所有公告（管理员功能）
async function getAllAnnouncements(supabase: any, params: URLSearchParams, user: any) {
  const status = params.get('status');
  const limit = parseInt(params.get('limit') || '50');
  const offset = parseInt(params.get('offset') || '0');

  try {
    // 检查用户权限（这里简化处理，实际应该检查管理员权限）
    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 根据状态过滤
    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({
        error: '获取公告列表失败',
        details: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: data || []
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '获取公告列表失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 获取通知统计
async function getNotificationStats(supabase: any, user: any) {
  try {
    const profileId = await getUserProfileId(supabase, user);
    const { data: notifications, error } = await supabase
      .rpc('get_user_notifications', { p_user_id: profileId });

    if (error) throw error;

    const stats = {
      total: notifications?.length || 0,
      unread: notifications?.filter((n: Notification) => n.status === 'unread').length || 0,
      read: notifications?.filter((n: Notification) => n.status === 'read').length || 0,
      handled: notifications?.filter((n: Notification) => n.status === 'handled').length || 0
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '获取统计失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 创建通知
async function createNotification(supabase: any, body: any, user: any) {
  const { target_user_id, type, title, content, metadata, priority } = body;

  if (!target_user_id || !type || !title) {
    return new Response(JSON.stringify({
      error: '缺少必要参数'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const profileId = await getUserProfileId(supabase, user);
    const { data, error } = await supabase
      .rpc('create_notification', {
        p_user_id: target_user_id,
        p_type: type,
        p_title: title,
        p_content: content,
        p_metadata: metadata,
        p_priority: priority || 0
      });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: { notification_id: data }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '创建通知失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 创建公告
async function createAnnouncement(supabase: any, body: any, user: any) {
  console.log('🔍 开始创建公告...');
  console.log('📝 请求数据:', body);
  console.log('👤 用户信息:', user);

  const { title, content, type, priority, target_roles, target_organizations, start_time, end_time } = body;

  if (!title || !content) {
    console.error('❌ 缺少必要参数');
    return new Response(JSON.stringify({
      error: '缺少必要参数',
      details: 'title和content是必填字段'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // 获取用户的profile ID（bigint类型）
    console.log('🔍 获取用户profile ID...');
    const profileId = await getUserProfileId(supabase, user);

    console.log('✅ 获取到用户profile ID:', profileId);

    console.log('📞 调用create_announcement函数...');
    const { data, error } = await supabase
      .rpc('create_announcement', {
        p_title: title,
        p_content: content,
        p_type: type || 'info',
        p_priority: priority || 0,
        p_target_roles: target_roles,
        p_target_organizations: target_organizations,
        p_start_time: start_time || new Date().toISOString(),
        p_end_time: end_time,
        p_created_by: profileId
      });

    if (error) {
      console.error('❌ 数据库函数调用失败:', error);
      throw error;
    }

    console.log('✅ 公告创建成功:', data);
    return new Response(JSON.stringify({
      success: true,
      data: { announcement_id: data }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ 创建公告失败:', error);
    console.error('❌ 错误详情:', error.message);
    console.error('❌ 错误堆栈:', error.stack);
    
    return new Response(JSON.stringify({
      error: '创建公告失败',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 标记通知为已读
async function markNotificationRead(supabase: any, body: any, user: any) {
  const { notification_id } = body;

  if (!notification_id) {
    return new Response(JSON.stringify({
      error: '缺少通知ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // 获取用户的profile ID（bigint类型）
    const profileId = await getUserProfileId(supabase, user);

    const { data, error } = await supabase
      .rpc('mark_notification_read', {
        p_notification_id: notification_id,
        p_user_id: profileId
      });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: '通知已标记为已读'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '标记已读失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 标记通知为已处理
async function markNotificationHandled(supabase: any, body: any, user: any) {
  const { notification_id } = body;

  if (!notification_id) {
    return new Response(JSON.stringify({
      error: '缺少通知ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // 获取用户的profile ID（bigint类型）
    const profileId = await getUserProfileId(supabase, user);

    const { data, error } = await supabase
      .rpc('mark_notification_handled', {
        p_notification_id: notification_id,
        p_user_id: profileId
      });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: '通知已标记为已处理'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '标记已处理失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 标记公告为已读
async function markAnnouncementRead(supabase: any, body: any, user: any) {
  const { announcement_id } = body;

  if (!announcement_id) {
    return new Response(JSON.stringify({
      error: '缺少公告ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // 获取用户的profile ID（bigint类型）
    const profileId = await getUserProfileId(supabase, user);

    const { data, error } = await supabase
      .rpc('mark_announcement_read', {
        p_announcement_id: announcement_id,
        p_user_id: profileId
      });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: '公告已标记为已读'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '标记已读失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 更新公告
async function updateAnnouncement(supabase: any, body: any, user: any) {
  const { id, title, content, type, priority, target_roles, target_organizations, is_active, start_time, end_time } = body;

  if (!id) {
    return new Response(JSON.stringify({
      error: '缺少公告ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const profileId = await getUserProfileId(supabase, user);
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (priority !== undefined) updateData.priority = priority;
    if (target_roles !== undefined) updateData.target_roles = target_roles;
    if (target_organizations !== undefined) updateData.target_organizations = target_organizations;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '更新公告失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 删除公告
async function deleteAnnouncement(supabase: any, params: URLSearchParams, user: any) {
  const announcement_id = params.get('id');

  if (!announcement_id) {
    return new Response(JSON.stringify({
      error: '缺少公告ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const profileId = await getUserProfileId(supabase, user);
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcement_id);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: '公告已删除'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: '删除公告失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// 删除通知
async function deleteNotification(supabase: any, params: URLSearchParams, user: any) {
  const notification_id = params.get('id');

  if (!notification_id) {
    return new Response(JSON.stringify({
      error: '缺少通知ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    console.log(`🗑️ 尝试删除通知: ${notification_id}, 用户: ${user.id}`);

    // 1. 查找当前用户的 profileId
    const profileId = await getUserProfileId(supabase, user);

    console.log(`✅ 找到用户profileId: ${profileId}`);

    // 2. 查找通知
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', notification_id)
      .single();

    if (fetchError || !notification) {
      console.log('❌ 通知不存在:', fetchError);
      return new Response(JSON.stringify({
        error: '通知不存在'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`✅ 找到通知, user_id: ${notification.user_id}, 当前用户: ${profileId}`);

    // 3. 校验权限
    if (notification.user_id !== profileId) {
      console.log('❌ 权限不足，无法删除此通知');
      return new Response(JSON.stringify({
        error: '无权删除此通知'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ 权限验证通过，开始删除通知');

    // 4. 删除通知
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notification_id);

    if (deleteError) {
      console.log('❌ 删除通知失败:', deleteError);
      throw deleteError;
    }

    console.log('✅ 通知删除成功');
    return new Response(JSON.stringify({
      success: true,
      message: '通知已删除'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.log('❌ 删除通知过程中发生错误:', error);
    return new Response(JSON.stringify({
      error: '删除通知失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
} 