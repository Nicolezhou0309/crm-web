// 跟进记录类型
export interface FollowupRecord {
  id: string;
  leadid: string;
  followupstage: string;
  phone?: string;
  wechat?: string;
  created_at: string;
  source?: string;
  interviewsales_user_id?: number | null;
  interviewsales_user_name?: string;
  interviewsales_user?: string;
  remark?: string;
  customerprofile?: string;
  worklocation?: string;
  userbudget?: string | number;
  moveintime?: string;
  userrating?: string;
  majorcategory?: string;
  followupresult?: string;
  scheduledcommunity?: string;
  scheduletime?: string;
  showingsales_user_id?: number | null;
  showingsales_user_name?: string;
  showingsales_user?: string;
  leadtype?: string;
  invalid?: boolean;
}

// 分页状态类型
export interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

// 筛选参数类型
export interface FilterParams {
  p_leadid?: string[];
  p_leadtype?: string[];
  p_interviewsales_user_id?: (number | null)[];
  p_followupstage?: string[];
  p_customerprofile?: string[];
  p_worklocation?: string[];
  p_userbudget?: (string | number)[];
  p_userrating?: string[];
  p_majorcategory?: string[];
  p_followupresult?: string[];
  p_scheduledcommunity?: string[];
  p_source?: string[];
  p_phone?: string[];
  p_wechat?: string[];
  p_remark?: string[];
  p_created_at_start?: string | null;
  p_created_at_end?: string | null;
  p_moveintime_start?: string | null;
  p_moveintime_end?: string | null;
  p_scheduletime_start?: string | null;
  p_scheduletime_end?: string | null;
  p_userbudget_min?: number;
  p_userbudget_max?: number;
  p_keyword?: string;
  p_subcategory?: string[];
  p_showingsales_user?: string[];
  p_limit?: number;
  p_offset?: number;
  // 添加索引签名以支持动态访问
  [key: string]: any;
}

// 筛选状态类型
export interface FilterState {
  [key: string]: any;
}

// 表格列筛选类型
export interface ColumnFilters {
  [key: string]: any;
}

// 分组数据类型
export interface GroupData {
  key: string; // 确保key始终是string类型，避免undefined
  groupValue: string;
  groupText: string;
  count: number;
}

// 跟进阶段类型
export type FollowupStage = '丢单' | '待接收' | '确认需求' | '邀约到店' | '已到店' | '赢单';

// 阶段字段配置类型
export interface StageFieldsConfig {
  [key: string]: string[];
}

// 枚举选项类型
export interface EnumOption {
  label: string;
  value: string;
}

// 地铁站选项类型
export interface MetroStationOption {
  value: string;
  label: string;
  children?: MetroStationOption[];
}

// 主要分类选项类型
export interface MajorCategoryOption {
  value: string;
  label: string;
  children?: MajorCategoryOption[];
}

// 用户类型
export interface UserProfile {
  id: number;
  nickname: string;
  status: string;
  organization_id?: number;
  organization_name?: string;
}

// 签约记录类型
export interface DealRecord {
  id: string;
  leadid: string;
  contractdate: string;
  community: string;
  contractnumber: string;
  roomnumber: string;
  created_at: string;
  isNew?: boolean;
  isEditing?: boolean;
}

// 回退申请类型
export interface RollbackApplication {
  id: string;
  leadid: string;
  reason: string;
  evidence: string[];
  status: string;
  created_at: string;
}

// 频率控制状态类型
export interface FrequencyControlState {
  isLimited: boolean;
  cooldown: {
    until: number;
    secondsLeft: number;
    message: string;
  } | null;
}
