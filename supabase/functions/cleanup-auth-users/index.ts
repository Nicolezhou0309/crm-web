// supabase/functions/cleanup-auth-users/index.ts

// 引入 Deno HTTP 服务和 Supabase JS 客户端
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    // 只允许 POST 请求，防止误操作
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }

    // 校验 Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');

    // 从环境变量获取 Supabase 项目地址和 service_role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 校验 token 并获取用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    // 不再校验管理员，所有登录用户可操作
    try {
        // 1. 删除所有 status='pending' 的 profile
        const { count: pendingProfilesCount, error: pendingProfilesError } = await supabase
          .from('users_profile')
          .delete({ count: 'exact' })
          .eq('status', 'pending');
        if (pendingProfilesError) throw pendingProfilesError;

        // 2. 获取所有未验证邮箱的用户id
        const { data: usersToCleanup, error: listError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        })
        if (listError) throw listError;
        const unconfirmedUserIds = usersToCleanup.users
          .filter(u => !u.email_confirmed_at)
          .map(u => u.id);

        // 3. 批量删除未验证邮箱的用户
        let deletedUsers = 0;
        let errors: { userId: string; error: string }[] = [];
        if (unconfirmedUserIds.length > 0) {
          // Supabase 没有批量删除API，只能并发Promise.all
          const results = await Promise.allSettled(
            unconfirmedUserIds.map(userId => supabase.auth.admin.deleteUser(userId))
          );
          deletedUsers = results.filter(r => r.status === 'fulfilled').length;
          errors = results
            .map((r, i) => r.status === 'rejected' ? { userId: unconfirmedUserIds[i], error: r.reason?.message || String(r.reason) } : null)
            .filter(Boolean) as { userId: string; error: string }[];
        }

        // 返回清理结果
        return new Response(JSON.stringify({
          totalPendingProfilesDeleted: pendingProfilesCount || 0,
          totalUnconfirmedUsers: unconfirmedUserIds.length,
          deletedUsers,
          errors
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
    } catch (error) {
      // 异常处理
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }
  })