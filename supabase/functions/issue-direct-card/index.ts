// supabase/functions/issue-direct-card/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

// 读取环境变量
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    });
  }

  try {
    // 只允许POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const body = await req.json();
    const { exchange_record_id } = body;
    if (!exchange_record_id) {
      return new Response(JSON.stringify({ success: false, error: '缺少exchange_record_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. 查询兑换记录
    const { data: record, error: recordError } = await supabase
      .from('points_exchange_records')
      .select('user_id, exchange_type')
      .eq('id', exchange_record_id)
      .single();

    if (recordError || !record) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '兑换记录不存在',
        details: recordError 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 2. 判断是否为带看卡类型
    if (record.exchange_type !== 'direct_card') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '该兑换不是带看卡',
        exchange_type: record.exchange_type 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 3. 查询用户信息
    const { data: userProfile, error: userError } = await supabase
      .from('users_profile')
      .select('organization_id, nickname')
      .eq('id', record.user_id)
      .single();

    if (userError || !userProfile) {
      return new Response(JSON.stringify({ success: false, error: '用户信息不存在' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 4. 查询组织信息和社区映射
    let targetUserId = record.user_id; // 默认给兑换人自己
    let community: string = '微领地青年社区'; // 默认社区
    
    if (userProfile.organization_id) {
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('admin, name')
        .eq('id', userProfile.organization_id)
        .single();

      if (!orgError && organization) {
        if (organization.admin) {
          // 将UUID转换为bigint类型的user_id
          const { data: adminProfile, error: adminError } = await supabase
            .from('users_profile')
            .select('id')
            .eq('user_id', organization.admin)
            .single();

          if (!adminError && adminProfile) {
            targetUserId = adminProfile.id; // 发放给组织组长
          }
        }
        
        // 从组织名称映射到社区
        if (organization.name) {
          const { data: communityMapping, error: mappingError } = await supabase
            .from('community_keywords')
            .select('community')
            .contains('keyword', [organization.name])
            .order('priority', { ascending: false })
            .limit(1)
            .single();

          if (!mappingError && communityMapping) {
            community = communityMapping.community;
          }
        }
      }
    }

    // 5. 插入带看直通卡
    const { error: insertError } = await supabase
      .from('showings_queue_record')
      .insert({
        user_id: targetUserId,
        community: community,
        queue_type: 'direct',
        remark: `${userProfile.nickname || '未知用户'}兑换带看卡`,
      });

    if (insertError) {
      return new Response(JSON.stringify({ success: false, error: '发放失败' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 6. 返回成功
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}); 