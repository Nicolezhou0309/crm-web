import { supabase } from '../supaClient';

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

// 积分成本规则API
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

// 分配记录API
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

// 统计API
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

// 导出API对象
export const pointsAllocationApi = {
  costRules,
  allocationRecords,
  stats
}; 