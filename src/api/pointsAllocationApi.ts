import { supabase } from '../supaClient';

// =====================================
// 类型定义
// =====================================

// 积分成本规则类型
export interface PointsCostRule {
  id: string;
  name: string;
  description?: string;
  base_points_cost: number;
  conditions: any;
  dynamic_cost_config: any;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 分配记录类型
export interface AllocationRecord {
  id: string;
  leadid: string;
  assigned_user_id: number;
  points_cost: number;
  user_balance_before: number;
  user_balance_after: number;
  allocation_status: string;
  created_at: string;
}

// API响应类型
export interface PointsAllocationApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

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

// =====================================
// 兼容性API对象 (用于AllocationManagement.tsx)
// =====================================

// 积分成本规则API (兼容旧版本)
const costRules = {
  getRules: async (): Promise<PointsAllocationApiResponse<PointsCostRule[]>> => {
    try {
      const { data, error } = await supabase
        .from('lead_points_cost')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('获取积分成本规则失败:', error);
      return { success: false, error: '获取积分成本规则失败' };
    }
  },

  createRule: async (rule: Partial<PointsCostRule>): Promise<PointsAllocationApiResponse<PointsCostRule>> => {
    try {
      const { data, error } = await supabase
        .from('lead_points_cost')
        .insert([rule])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('创建积分成本规则失败:', error);
      return { success: false, error: '创建积分成本规则失败' };
    }
  },

  updateRule: async (id: string, rule: Partial<PointsCostRule>): Promise<PointsAllocationApiResponse<PointsCostRule>> => {
    try {
      const { data, error } = await supabase
        .from('lead_points_cost')
        .update(rule)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('更新积分成本规则失败:', error);
      return { success: false, error: '更新积分成本规则失败' };
    }
  },

  deleteRule: async (id: string): Promise<PointsAllocationApiResponse<void>> => {
    try {
      const { error } = await supabase
        .from('lead_points_cost')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('软删除积分成本规则失败:', error);
      return { success: false, error: '软删除积分成本规则失败' };
    }
  }
};

// 分配记录API (兼容旧版本)
const allocationRecords = {
  getRecords: async (filters: any = {}): Promise<PointsAllocationApiResponse<AllocationRecord[]>> => {
    try {
      let query = supabase
        .from('simple_allocation_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // 添加筛选条件
      if (filters.leadid) {
        query = query.ilike('leadid', `%${filters.leadid}%`);
      }
      if (filters.assigned_user_id) {
        query = query.eq('assigned_user_id', filters.assigned_user_id);
      }
      if (filters.allocation_method) {
        query = query.eq('allocation_method', filters.allocation_method);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('获取分配记录失败:', error);
      return { success: false, error: '获取分配记录失败' };
    }
  }
};

// 统计API (兼容旧版本)
const stats = {
  getStats: async (): Promise<PointsAllocationApiResponse<any>> => {
    try {
      // 这里可以添加统计查询
      const stats = {
        total_rules: 0,
        active_rules: 0,
        total_allocations: 0,
        total_points_cost: 0
      };
      
      return { success: true, data: stats };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      return { success: false, error: '获取统计数据失败' };
    }
  }
};

// 导出兼容性API对象 (用于AllocationManagement.tsx)
export const pointsAllocationApi = {
  costRules,
  allocationRecords,
  stats
}; 