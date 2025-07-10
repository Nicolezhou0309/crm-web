import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

interface AllocationRule {
  id?: string;
  name: string;
  description?: string;
  organization_id: string;
  is_active: boolean;
  priority: number;
  source_types?: string[];
  lead_types?: string[];
  community_types?: string[];
  time_ranges?: {
    start?: string;
    end?: string;
    weekdays?: number[];
  };
  target_type: 'user' | 'organization';
  target_users?: number[];
  target_organizations?: string[];
  allocation_method: 'round_robin' | 'random' | 'workload';
}

interface AllocationStats {
  total_leads: number;
  allocated_leads: number;
  duplicate_leads: number;
  allocation_rate: number;
  duplicate_rate: number;
  avg_processing_time_ms: number;
  date_range: {
    start: string;
    end: string;
  };
}

interface DuplicateNotification {
  id: string;
  new_leadid: string;
  original_leadid: string;
  duplicate_type: 'phone' | 'wechat' | 'both';
  customer_phone?: string;
  customer_wechat?: string;
  notification_status: 'pending' | 'sent' | 'read' | 'handled';
  created_at: string;
  new_lead_info: any;
  original_lead_info: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    console.log('收到分配管理请求:', req.method, req.url);
    
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
        return await handleGet(supabase, action, url.searchParams);
      case 'POST':
        return await handlePost(supabase, action, await req.json());
      case 'PUT':
        return await handlePut(supabase, action, await req.json());
      case 'DELETE':
        return await handleDelete(supabase, action, url.searchParams);
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

// GET请求处理
async function handleGet(supabase: any, action: string | null, params: URLSearchParams) {
  switch (action) {
    case 'rules':
      return await getRules(supabase, params);
    case 'stats':
      return await getStats(supabase, params);
    case 'notifications':
      return await getNotifications(supabase, params);
    case 'enum_values':
      return await getEnumValues(supabase, params);
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
async function handlePost(supabase: any, action: string | null, body: any) {
  switch (action) {
    case 'create_rule':
      return await createRule(supabase, body);
    case 'test_allocation':
      return await testAllocation(supabase, body);
    case 'create-lead-with-assignment':
      return await handleCreateLeadWithAssignment(body, supabase);
    case 'reassign':
      return await reassignLead(supabase, body);
    case 'reallocate-by-community':
      return await reallocateByCommunity(supabase, body);
    case 'batch-reallocate-by-community':
      return await batchReallocateByCommunity(supabase, body);
    case 'community-mapping':
      const { action: mappingAction, ...mappingData } = body;
      
      switch(mappingAction) {
        case 'list':
          const { data: mappingRules, error: listError } = await supabase
            .from('community_mapping_rules')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true });
          
          if (listError) {
            return errorResponse('获取社区映射规则失败', listError);
          }
          
          return successResponse(mappingRules);
        
        case 'create':
          const { 
            name, description, target_community, priority = 0,
            campaign_ids, campaign_names, unit_ids, unit_names,
            creative_ids, creative_names, areas, locations,
            confidence_score = 100
          } = mappingData;
          
          if (!name || !target_community) {
            return errorResponse('缺少必要参数：name和target_community');
          }
          
          const { data: newRule, error: createError } = await supabase
            .rpc('create_community_mapping_rule', {
              p_name: name,
              p_description: description,
              p_target_community: target_community,
              p_campaign_ids: campaign_ids,
              p_campaign_names: campaign_names,
              p_unit_ids: unit_ids,
              p_unit_names: unit_names,
              p_creative_ids: creative_ids,
              p_creative_names: creative_names,
              p_areas: areas,
              p_locations: locations,
              p_priority: priority,
              p_confidence_score: confidence_score
            });
          
          if (createError) {
            return errorResponse('创建社区映射规则失败', createError);
          }
          
          return successResponse({ rule_id: newRule });
        
        case 'update':
          const { id: ruleId, ...updateData } = mappingData;
          
          if (!ruleId) {
            return errorResponse('缺少规则ID');
          }
          
          const { error: updateError } = await supabase
            .from('community_mapping_rules')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', ruleId);
          
          if (updateError) {
            return errorResponse('更新社区映射规则失败', updateError);
          }
          
          return successResponse({ message: '社区映射规则已更新' });
        
        case 'delete':
          const { id: deleteId } = mappingData;
          
          if (!deleteId) {
            return errorResponse('缺少规则ID');
          }
          
          const { error: deleteError } = await supabase
            .from('community_mapping_rules')
            .delete()
            .eq('id', deleteId);
          
          if (deleteError) {
            return errorResponse('删除社区映射规则失败', deleteError);
          }
          
          return successResponse({ message: '社区映射规则已删除' });
        
        case 'test':
          const {
            campaign_id, campaign_name, unit_id, unit_name,
            creative_id, creative_name, area, location
          } = mappingData;
          
          const { data: testResult, error: testError } = await supabase
            .rpc('test_community_mapping', {
              p_campaign_id: campaign_id,
              p_campaign_name: campaign_name,
              p_unit_id: unit_id,
              p_unit_name: unit_name,
              p_creative_id: creative_id,
              p_creative_name: creative_name,
              p_area: area,
              p_location: location
            });
          
          if (testError) {
            return errorResponse('测试社区映射失败', testError);
          }
          
          return successResponse(testResult);
        
        default:
          return errorResponse('不支持的社区映射操作');
      }
      
    case 'community-reallocation':
      const { leadid: reallocLeadId, community } = body;
      
      if (!reallocLeadId || !community) {
        return errorResponse('缺少必要参数：leadid和community');
      }
      
      const { data: reallocationResult, error: reallocationError } = await supabase
        .rpc('reallocate_by_community', {
          p_leadid: reallocLeadId,
          p_community: community
        });
      
      if (reallocationError) {
        return errorResponse('基于社区重新分配失败', reallocationError);
      }
      
      return successResponse(reallocationResult);
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
async function handlePut(supabase: any, action: string | null, body: any) {
  switch (action) {
    case 'update_rule':
      return await updateRule(supabase, body);
    case 'handle_notification':
      return await handleNotification(supabase, body);
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
async function handleDelete(supabase: any, action: string | null, params: URLSearchParams) {
  switch (action) {
    case 'rule':
      return await deleteRule(supabase, params);
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

// 获取分配规则
async function getRules(supabase: any, params: URLSearchParams) {
  const organizationId = params.get('organization_id');
  const isActive = params.get('is_active');
  
  let query = supabase
    .from('allocation_rules')
    .select('*')
    .order('priority', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true');
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({
      error: '获取分配规则失败',
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
    data
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 获取分配统计
async function getStats(supabase: any, params: URLSearchParams) {
  const organizationId = params.get('organization_id');
  const dateStart = params.get('date_start');
  const dateEnd = params.get('date_end');

  const { data, error } = await supabase.rpc('get_allocation_stats', {
    org_id: organizationId,
    date_start: dateStart,
    date_end: dateEnd
  });

  if (error) {
    return new Response(JSON.stringify({
      error: '获取分配统计失败',
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
    data
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 获取重复客户通知
async function getNotifications(supabase: any, params: URLSearchParams) {
  const userId = params.get('user_id');
  const status = params.get('status');

  if (!userId) {
    return new Response(JSON.stringify({
      error: '缺少用户ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  const { data, error } = await supabase.rpc('get_duplicate_notifications', {
    user_id: parseInt(userId)
  });

  if (error) {
    return new Response(JSON.stringify({
      error: '获取重复客户通知失败',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  // 如果指定了状态，进行过滤
  let filteredData = data;
  if (status) {
    filteredData = data.filter((item: DuplicateNotification) => item.notification_status === status);
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
}

// 获取枚举值
async function getEnumValues(supabase: any, params: URLSearchParams) {
  const enumName = params.get('enum_name');
  
  if (!enumName) {
    return new Response(JSON.stringify({
      error: '缺少枚举名称'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  const { data, error } = await supabase.rpc('get_enum_values', {
    enum_name: enumName
  });

  if (error) {
    return new Response(JSON.stringify({
      error: '获取枚举值失败',
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
    data
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 创建分配规则
async function createRule(supabase: any, rule: AllocationRule) {
  const { data, error } = await supabase
    .from('allocation_rules')
    .insert(rule)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({
      error: '创建分配规则失败',
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
    message: '分配规则创建成功',
    data
  }), {
    status: 201,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 更新分配规则
async function updateRule(supabase: any, body: { id: string } & Partial<AllocationRule>) {
  const { id, ...updateData } = body;
  
  const { data, error } = await supabase
    .from('allocation_rules')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({
      error: '更新分配规则失败',
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
    message: '分配规则更新成功',
    data
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 删除分配规则
async function deleteRule(supabase: any, params: URLSearchParams) {
  const ruleId = params.get('id');
  
  if (!ruleId) {
    return new Response(JSON.stringify({
      error: '缺少规则ID'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  const { error } = await supabase
    .from('allocation_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    return new Response(JSON.stringify({
      error: '删除分配规则失败',
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
    message: '分配规则删除成功'
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 处理重复客户通知
async function handleNotification(supabase: any, body: { notification_id: string }) {
  const { notification_id } = body;

  const { data, error } = await supabase.rpc('mark_notification_handled', {
    notification_id
  });

  if (error) {
    return new Response(JSON.stringify({
      error: '处理通知失败',
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
    message: '通知已处理',
    data
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 测试分配（用于调试）
async function testAllocation(supabase: any, body: { lead_data: any }) {
  const { lead_data } = body;
  
  // 这里可以添加测试分配逻辑的代码
  // 暂时返回一个模拟结果
  return new Response(JSON.stringify({
    success: true,
    message: '测试分配功能',
    data: {
      test_result: '分配测试功能待实现',
      lead_data
    }
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// 带手动分配的线索创建（增强版，支持社区）
async function handleCreateLeadWithAssignment(body: any, supabase: any) {
  const { 
    lead_data, 
    assigned_user_id, 
    community,
    reason = '手动指定分配' 
  } = body;
  
  if (!lead_data) {
    return new Response(JSON.stringify({ 
      error: '缺少线索数据' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 构建增强的线索数据
    const enhancedLeadData = { ...lead_data };
    
    // 方式1：通过remark字段传递分配信息
    let assignmentInfo = [];
    if (assigned_user_id) {
      assignmentInfo.push(`MANUAL_ASSIGN:${assigned_user_id}`);
    }
    if (community) {
      assignmentInfo.push(`COMMUNITY:${community}`);
    }
    
    if (assignmentInfo.length > 0) {
      const assignmentString = assignmentInfo.join('|');
      enhancedLeadData.remark = enhancedLeadData.remark 
        ? `${enhancedLeadData.remark}|${assignmentString}`
        : assignmentString;
    }
    
    // 创建线索（触发器会自动处理分配）
    const { data: leadResult, error: leadError } = await supabase
      .from('leads')
      .insert(enhancedLeadData)
      .select()
      .single();
    
    if (leadError) {
      console.error('创建线索失败:', leadError);
      return new Response(JSON.stringify({
        error: '创建线索失败',
        details: leadError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 获取分配结果
    const { data: followupResult, error: followupError } = await supabase
      .from('followups')
      .select(`
        *,
        assigned_user:users_profile!interviewsales_user_id(id, nickname)
      `)
      .eq('leadid', leadResult.leadid)
      .single();
    
    if (followupError) {
      console.error('获取分配结果失败:', followupError);
    }
    
    // 获取分配日志
    const { data: allocationLog } = await supabase
      .from('allocation_logs')
      .select('*')
      .eq('leadid', leadResult.leadid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return new Response(JSON.stringify({
      success: true,
      message: '线索创建并分配成功',
      data: {
        lead: leadResult,
        followup: followupResult,
        allocation_log: allocationLog,
        assignment_details: {
          assigned_user_id: followupResult?.interviewsales_user_id,
          assigned_user_name: followupResult?.assigned_user?.nickname,
          community: followupResult?.scheduledcommunity,
          method: allocationLog?.allocation_method,
          source: allocationLog?.allocation_details?.assignment_source
        }
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('处理带分配的线索创建时出错:', error);
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 手动重新分配线索
async function reassignLead(supabase: any, body: { leadid: string, new_user_id: number, reason?: string }) {
  const { leadid, new_user_id, reason } = body;

  if (!leadid || !new_user_id) {
    return new Response(JSON.stringify({ error: '缺少必要参数' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 验证新销售人员
  const { data: user, error: userError } = await supabase
    .from('users_profile')
    .select('id, nickname, status')
    .eq('id', new_user_id)
    .single();

  if (userError || !user || user.status !== 'active') {
    return new Response(JSON.stringify({ error: '指定的销售人员无效' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 更新followups记录
  const { data: updated, error: updateError } = await supabase
    .from('followups')
    .update({ 
      interviewsales_user_id: new_user_id,
      updated_at: new Date().toISOString()
    })
    .eq('leadid', leadid)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ 
      error: '重新分配失败', 
      details: updateError.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 记录重新分配日志
  await supabase
    .from('allocation_logs')
    .insert({
      leadid,
      assigned_user_id: new_user_id,
      allocation_method: 'manual_reassign',
      is_duplicate: false,
      allocation_details: {
        reassign_reason: reason,
        manual_assignment: true,
        assignment_source: 'manual_reassign'
      }
    });

  return new Response(JSON.stringify({
    success: true,
    data: {
      followup: updated,
      assigned_user: user
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 基于社区的重新分配
async function reallocateByCommunity(supabase: any, body: { leadid: string, community: string }) {
  const { leadid, community } = body;
  
  if (!leadid || !community) {
    return new Response(JSON.stringify({ error: '缺少必要参数：leadid和community' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // 调用重新分配函数
  const { data: reallocationResult, error: reallocationError } = await supabase
    .rpc('reallocate_by_community', {
      p_leadid: leadid,
      p_community: community
    });
  
  if (reallocationError) {
    return new Response(JSON.stringify({ error: '基于社区重新分配失败', details: reallocationError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: '基于社区重新分配完成',
    data: reallocationResult
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 批量社区重新分配
async function batchReallocateByCommunity(supabase: any, body: { community: string, date_start?: string, date_end?: string }) {
  const { community, date_start, date_end } = body;
  
  if (!community) {
    return new Response(JSON.stringify({ error: '缺少必要参数：community' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // 调用批量重新分配函数
  const { data: batchResult, error: batchError } = await supabase
    .rpc('batch_reallocate_by_community', {
      p_community: community,
      p_date_start: date_start || null,
      p_date_end: date_end || null
    });
  
  if (batchError) {
    return new Response(JSON.stringify({ error: '批量社区重新分配失败', details: batchError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: '批量社区重新分配完成',
    data: batchResult
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
} 