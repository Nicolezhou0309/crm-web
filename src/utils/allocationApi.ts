import { supabase } from '../supaClient';
import type { SimpleAllocationRule, UserGroup, SimpleAllocationLog, AllocationApiResponse } from '../types/allocation';

// 规则相关API
const rules = {
  getRules: async (): Promise<AllocationApiResponse<SimpleAllocationRule[]>> => {
    try {
      const { data, error } = await supabase
        .from('simple_allocation_rules')
        .select('*')
        .order('priority');
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取分配规则失败' };
    }
  },

  createRule: async (rule: Partial<SimpleAllocationRule>): Promise<AllocationApiResponse<SimpleAllocationRule>> => {
    try {
      const { data, error } = await supabase
        .from('simple_allocation_rules')
        .insert([rule])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '创建分配规则失败' };
    }
  },

  updateRule: async (id: string, rule: Partial<SimpleAllocationRule>): Promise<AllocationApiResponse<SimpleAllocationRule>> => {
    try {
      const { data, error } = await supabase
        .from('simple_allocation_rules')
        .update(rule)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '更新分配规则失败' };
    }
  },

  deleteRule: async (id: string): Promise<AllocationApiResponse<void>> => {
    try {
      const { error } = await supabase
        .from('simple_allocation_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: '删除分配规则失败' };
    }
  },

  // 新增：测试分配方法
  testAllocation: async (params: {
    source: string;
    leadtype?: string;
    community?: string;
    test_mode?: boolean;
  }): Promise<AllocationApiResponse<{
    assigned_user_id: number;
    allocation_method: string;
    rule_name?: string;
    matched_rule?: SimpleAllocationRule;
    allocation_steps?: any[];
    final_group?: UserGroup;
    conditions_matched?: any;
  }>> => {
    try {
      const { data, error } = await supabase
        .rpc('test_allocation', {
          p_source: params.source,
          p_leadtype: params.leadtype,
          p_community: params.community,
          p_test_mode: params.test_mode ?? true
        });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: '测试分配失败',
        details: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
};

// 销售组相关API
const groups = {
  getGroups: async (): Promise<AllocationApiResponse<UserGroup[]>> => {
    try {
      
      const { data, error } = await supabase
        .from('users_list')
        .select('*')
        .order('groupname');
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取销售组失败' };
    }
  },

  createGroup: async (group: Partial<UserGroup>): Promise<AllocationApiResponse<UserGroup>> => {
    try {
      
      const { data, error } = await supabase
        .from('users_list')
        .insert([group])
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: '创建销售组失败',
        details: error instanceof Error ? error.message : '未知错误'
      };
    }
  },

  updateGroup: async (id: number, group: Partial<UserGroup>): Promise<AllocationApiResponse<UserGroup>> => {
    try {
      const { data, error } = await supabase
        .from('users_list')
        .update(group)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '更新销售组失败' };
    }
  },

  deleteGroup: async (id: number): Promise<AllocationApiResponse<void>> => {
    try {
      const { error } = await supabase
        .from('users_list')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: '删除销售组失败' };
    }
  }
};

// 分配日志相关API
const logs = {
  getLogs: async ({ limit = 50 } = {}): Promise<AllocationApiResponse<SimpleAllocationLog[]>> => {
    try {
      const { data, error } = await supabase
        .from('simple_allocation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取分配日志失败' };
    }
  }
};

// 统计相关API
const stats = {
  getStats: async (): Promise<AllocationApiResponse<any>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_allocation_stats');
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取统计数据失败' };
    }
  }
};

// 枚举值相关API
const enums = {
  getSourceTypes: async (): Promise<AllocationApiResponse<string[]>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_enum_values', { enum_name: 'source' });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取来源类型失败' };
    }
  },

  getCommunityTypes: async (): Promise<AllocationApiResponse<string[]>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_enum_values', { enum_name: 'community' });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取社区类型失败' };
    }
  },

  getAllocationMethods: async (): Promise<AllocationApiResponse<string[]>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_enum_values', { enum_name: 'allocation_method' });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取分配方式失败' };
    }
  },

  getCommunityKeywords: async (): Promise<AllocationApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase
        .from('community_keywords')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取社区关键词失败' };
    }
  }
};

// 社区关键词管理
const communityKeywords = {
  getKeywords: async (): Promise<AllocationApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase
        .from('community_keywords')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '获取社区关键词失败' };
    }
  },

  createKeyword: async (keyword: any): Promise<AllocationApiResponse<any>> => {
    try {
      const { data, error } = await supabase
        .from('community_keywords')
        .insert([keyword])
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: '创建社区关键词失败' };
    }
  },

  updateKeyword: async (id: number, keyword: any): Promise<AllocationApiResponse<any>> => {
    try {
      const { data, error } = await supabase
        .from('community_keywords')
        .update(keyword)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) { 
      return { success: false, error: '更新社区关键词失败' };
    }
  },

  deleteKeyword: async (id: number): Promise<AllocationApiResponse<void>> => {
    try {
      const { error } = await supabase
        .from('community_keywords')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) { 
      return { success: false, error: '删除社区关键词失败' };
    }
  }
};

// 导出API对象
export const allocationApi = {
  rules,
  groups,
  logs,
  stats,
  enums,
  communityKeywords
}; 