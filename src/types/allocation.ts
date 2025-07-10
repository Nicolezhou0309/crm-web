// 分配规则类型
export interface SimpleAllocationRule {
  id: string;
  name: string;
  description?: string;
  conditions: {
    sources?: string[];
    communities?: string[];
    lead_types?: string[];
    time_ranges?: {
      start?: string;
      end?: string;
      weekdays?: number[];
    };
  };
  user_groups: number[];
  allocation_method: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  enable_permission_check?: boolean;
}

// 销售组类型
export interface UserGroup {
  id: number;
  groupname: string;
  description?: string;
  list: number[];
  allocation: string;
  enable_quality_control: boolean;
  daily_lead_limit?: number;
  conversion_rate_requirement?: number;
  max_pending_leads?: number;
  enable_community_matching: boolean;
  created_at?: string;
  updated_at?: string;
}

// 分配日志类型
export interface SimpleAllocationLog {
  id: string;
  leadid: string;
  assigned_user_id: number;
  allocation_method: string;
  processing_details?: {
    rule_name?: string;
    rule_id?: string;
    conditions?: {
      sources?: string[];
      communities?: string[];
      lead_types?: string[];
      time_ranges?: {
        start?: string;
        end?: string;
        weekdays?: number[];
      };
    };
    group_info?: {
      id: number;
      groupname: string;
      allocation: string;
    };
    allocation_steps?: Array<{
      step: string;
      result: any;
      timestamp: string;
    }>;
  };
  created_at: string;
}

// API响应类型
export interface AllocationApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

// 分配统计类型
export interface AllocationStats {
  total_allocations: number;
  active_rules: number;
  user_groups: number;
  success_rate: number;
}

// 分配规则表单类型
export interface AllocationRuleForm {
  name: string;
  description?: string;
  conditions: {
    sources?: string[];
    communities?: string[];
    lead_types?: string[];
    time_ranges?: {
      start?: string;
      end?: string;
      weekdays?: number[];
    };
  };
  user_groups: number[];
  allocation_method: string;
  priority: number;
  is_active: boolean;
}

// 分配方法常量
export const ALLOCATION_METHODS = [
  { value: 'round_robin', label: '轮流分配', description: '按顺序轮流分配给销售组成员' },
  { value: 'random', label: '随机分配', description: '随机分配给销售组成员' },
  { value: 'workload', label: '工作量均衡', description: '根据当前工作量自动分配' }
];

// 工作日选项
export const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
];

// Select 选项类型
export interface SelectOption {
  value: string | number;
  label: string;
  children?: string;
} 