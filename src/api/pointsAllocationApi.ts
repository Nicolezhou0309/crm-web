import { supabase } from '../supaClient';

// =====================================
// 积分成本规则管理
// =====================================

// 获取积分成本规则列表
export async function getPointsCostRules() {
  const { data, error } = await supabase
    .from('lead_points_cost')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

// 创建积分成本规则
export async function createPointsCostRule(ruleData: {
  name: string;
  description?: string;
  base_points_cost: number;
  conditions?: any;
  dynamic_cost_config?: any;
  priority?: number;
  is_active?: boolean;
}) {
  const { data, error } = await supabase
    .from('lead_points_cost')
    .insert([ruleData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// 更新积分成本规则
export async function updatePointsCostRule(ruleId: string, ruleData: any) {
  const { data, error } = await supabase
    .from('lead_points_cost')
    .update(ruleData)
    .eq('id', ruleId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// 删除积分成本规则
export async function deletePointsCostRule(ruleId: string) {
  const { error } = await supabase
    .from('lead_points_cost')
    .delete()
    .eq('id', ruleId);
  
  if (error) throw error;
  return true;
}

// =====================================
// 积分分配记录管理
// =====================================

// 获取积分分配记录
export async function getPointsAllocationRecords(filters: Record<string, any> = {}) {
  let query = supabase
    .from('points_allocation_records')
    .select('*');

  // 动态添加筛选条件
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && !['orderBy', 'ascending', 'limit', 'offset'].includes(key)) {
      query = query.eq(key, value);
    }
  });

  // 支持排序和分页
  if (filters.orderBy) {
    query = query.order(filters.orderBy, { ascending: !!filters.ascending });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// 获取积分分配统计
export async function getPointsAllocationStats() {
  const { data, error } = await supabase
    .from('points_allocation_stats')
    .select('*')
    .order('allocation_date', { ascending: false })
    .limit(30);
  
  if (error) throw error;
  return data;
}

// =====================================
// 积分分配功能
// =====================================

// 计算线索积分成本
export async function calculateLeadPointsCost(params: {
  source?: string;
  leadtype?: string;
  community?: string;
  campaignname?: string;
  unitname?: string;
  remark?: string;
}) {
  const { data, error } = await supabase.rpc('calculate_lead_points_cost', params);
  if (error) throw error;
  return data;
}

// 检查用户积分余额
export async function checkUserPointsBalance(userId: number, requiredPoints: number) {
  const { data, error } = await supabase.rpc('check_user_points_balance', {
    p_user_id: userId,
    p_required_points: requiredPoints
  });
  if (error) throw error;
  return data;
}

// 带积分的线索分配
export async function allocateLeadWithPoints(params: {
  leadid: string;
  source?: string;
  leadtype?: string;
  community?: string;
  manual_user_id?: number;
  enable_points_check?: boolean;
}) {
  const { data, error } = await supabase.rpc('allocate_lead_with_points', params);
  if (error) throw error;
  return data;
}

// =====================================
// 用户积分分配相关
// =====================================

// 获取用户积分分配历史
export async function getUserPointsAllocationHistory(userId: number, filters: Record<string, any> = {}) {
  let query = supabase
    .from('points_allocation_records')
    .select('*')
    .eq('assigned_user_id', userId);

  // 动态添加筛选条件
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && !['orderBy', 'ascending', 'limit', 'offset'].includes(key)) {
      query = query.eq(key, value);
    }
  });

  // 支持排序和分页
  if (filters.orderBy) {
    query = query.order(filters.orderBy, { ascending: !!filters.ascending });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// 获取用户积分分配统计
export async function getUserPointsAllocationStats(userId: number) {
  // 获取所有记录
  const { data: allRecords, error } = await supabase
    .from('points_allocation_records')
    .select('*')
    .eq('assigned_user_id', userId);
  
  if (error) throw error;
  
  const records = allRecords || [];
  const total_allocations = records.length;
  const successful_allocations = records.filter(r => r.allocation_status === 'success').length;
  const insufficient_points_allocations = records.filter(r => r.allocation_status === 'insufficient_points').length;
  const total_points_cost = records.reduce((sum, r) => sum + (r.points_cost || 0), 0);
  const successful_points_cost = records
    .filter(r => r.allocation_status === 'success')
    .reduce((sum, r) => sum + (r.points_cost || 0), 0);
  const avg_points_cost = total_allocations > 0 ? total_points_cost / total_allocations : 0;
  
  return {
    total_allocations,
    successful_allocations,
    insufficient_points_allocations,
    total_points_cost,
    successful_points_cost,
    avg_points_cost: Math.round(avg_points_cost * 100) / 100
  };
}

// =====================================
// 系统验证和测试
// =====================================

// 验证积分分配系统
export async function validatePointsAllocationSystem() {
  const { data, error } = await supabase.rpc('validate_points_allocation_system');
  if (error) throw error;
  return data;
}

// 测试积分分配功能
export async function testPointsAllocation(params: {
  source?: string;
  leadtype?: string;
  community?: string;
}) {
  const testLeadId = 'TEST_' + Date.now();
  const { data, error } = await supabase.rpc('allocate_lead_with_points', {
    p_leadid: testLeadId,
    p_source: params.source,
    p_leadtype: params.leadtype,
    p_community: params.community,
    p_enable_points_check: true
  });
  if (error) throw error;
  return data;
} 