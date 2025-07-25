import { supabase } from '../supaClient';

export interface Showing {
  id: string;
  leadid: string;
  scheduletime: string | null;
  community: string | null;
  arrivaltime: string | null;
  showingsales: number | null;
  trueshowingsales: number | null;
  viewresult: string;
  budget: number;
  moveintime: string;
  remark: string;
  renttime: number;
  created_at: string;
  updated_at: string;
  invalid?: boolean; // 是否无效（回退/作废）
}

export interface ShowingFilters {
  leadid?: string;
  community?: string[];
  showingsales?: number[];
  trueshowingsales?: number[];
  interviewsales?: number[];
  viewresult?: string[];
  budget_min?: number;
  budget_max?: number;
  renttime_min?: number;
  renttime_max?: number;
  scheduletime_start?: string;
  scheduletime_end?: string;
  arrivaltime_start?: string;
  arrivaltime_end?: string;
  moveintime_start?: string;
  moveintime_end?: string;
  created_at_start?: string;
  created_at_end?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  incomplete?: boolean; // 新增：筛选未填写工单
}

// 获取带看记录列表（支持多字段筛选）
export async function getShowings(filters: ShowingFilters = {}) {
  const { data, error } = await supabase.rpc('filter_showings', {
    p_leadid: filters.leadid,
    p_community: filters.community,
    p_showingsales: filters.showingsales,
    p_trueshowingsales: filters.trueshowingsales,
    p_interviewsales: filters.interviewsales,
    p_viewresult: filters.viewresult,
    p_budget_min: filters.budget_min,
    p_budget_max: filters.budget_max,
    p_renttime_min: filters.renttime_min,
    p_renttime_max: filters.renttime_max,
    p_scheduletime_start: filters.scheduletime_start,
    p_scheduletime_end: filters.scheduletime_end,
    p_arrivaltime_start: filters.arrivaltime_start,
    p_arrivaltime_end: filters.arrivaltime_end,
    p_moveintime_start: filters.moveintime_start,
    p_moveintime_end: filters.moveintime_end,
    p_created_at_start: filters.created_at_start,
    p_created_at_end: filters.created_at_end,
    p_order_by: filters.orderBy || 'created_at',
    p_ascending: filters.ascending || false,
    p_limit: filters.limit || 10,
    p_offset: filters.offset || 0,
    p_incomplete: filters.incomplete || false
  });
  
  if (error) throw error;
  return data;
}

// 获取带看记录总数（用于分页）
export async function getShowingsCount(filters: ShowingFilters = {}) {
  const { data, error } = await supabase.rpc('get_showings_count', {
    p_leadid: filters.leadid,
    p_community: filters.community,
    p_showingsales: filters.showingsales,
    p_trueshowingsales: filters.trueshowingsales,
    p_interviewsales: filters.interviewsales,
    p_viewresult: filters.viewresult,
    p_budget_min: filters.budget_min,
    p_budget_max: filters.budget_max,
    p_renttime_min: filters.renttime_min,
    p_renttime_max: filters.renttime_max,
    p_scheduletime_start: filters.scheduletime_start,
    p_scheduletime_end: filters.scheduletime_end,
    p_arrivaltime_start: filters.arrivaltime_start,
    p_arrivaltime_end: filters.arrivaltime_end,
    p_moveintime_start: filters.moveintime_start,
    p_moveintime_end: filters.moveintime_end,
    p_created_at_start: filters.created_at_start,
    p_created_at_end: filters.created_at_end,
    p_incomplete: filters.incomplete || false
  });
  
  if (error) throw error;
  return data || 0;
}

// 获取社区枚举值
export async function getCommunityOptions() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'community' });
  if (error) throw error;
  return data || [];
}

// 获取带看结果枚举值
export async function getViewResultOptions() {
  const { data, error } = await supabase.rpc('get_showings_viewresult_options');
  if (error) throw error;
  return data || [];
}

// 获取销售员列表（用于筛选）
export async function getSalesOptions() {
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, nickname')
    .eq('status', 'active')
    .order('nickname');
  
  if (error) throw error;
  return data || [];
}

// 创建带看记录
export async function createShowing(showingData: Partial<Showing>) {
  const { data, error } = await supabase
    .from('showings')
    .insert([showingData])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 更新带看记录
export async function updateShowing(id: string, showingData: Partial<Showing>) {
  const { data, error } = await supabase
    .from('showings')
    .update(showingData)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 删除带看记录
export async function deleteShowing(id: string) {
  const { error } = await supabase
    .from('showings')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
} 

// 转化率统计相关接口
export interface ConversionRateStats {
  sales_id: number;
  sales_name: string;
  showings_count: number;
  direct_deal_count: number;
  reserved_count: number;
  intention_count: number;
  considering_count: number;
  lost_count: number;
  unfilled_count: number;
  direct_rate: number;
  conversion_rate: number;
  previous_showings_count: number;
  previous_direct_deal_count: number;
  previous_reserved_count: number;
  previous_intention_count: number;
  previous_considering_count: number;
  previous_lost_count: number;
  previous_unfilled_count: number;
  previous_direct_rate: number;
  previous_conversion_rate: number;
}

export interface ConversionRateStatsWithActualSales extends ConversionRateStats {
  actual_sales_id: number | null;
  actual_sales_name: string | null;
  is_actual_sales: boolean;
}

export interface ConversionRateParams {
  date_start?: string;
  date_end?: string;
  previous_date_start?: string;
  previous_date_end?: string;
}

// 获取转化率统计数据（基础版本）
export async function getConversionRateStats(params: ConversionRateParams = {}) {
  const { data, error } = await supabase.rpc('get_conversion_rate_stats', {
    p_date_start: params.date_start || null,
    p_date_end: params.date_end || null,
    p_previous_date_start: params.previous_date_start || null,
    p_previous_date_end: params.previous_date_end || null
  });
  
  if (error) throw error;
  return data as ConversionRateStats[];
}

// 获取转化率统计数据（包含实际销售分组）
export async function getConversionRateStatsWithActualSales(params: ConversionRateParams = {}) {
  const { data, error } = await supabase.rpc('get_conversion_rate_stats_with_actual_sales', {
    p_date_start: params.date_start || null,
    p_date_end: params.date_end || null,
    p_previous_date_start: params.previous_date_start || null,
    p_previous_date_end: params.previous_date_end || null
  });
  
  if (error) throw error;
  return data as ConversionRateStatsWithActualSales[];
} 