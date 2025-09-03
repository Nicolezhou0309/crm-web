import { supabase } from '../supaClient';

export interface Deal {
  id: string;
  leadid: string;
  contractdate: string | null;
  community: string | null;
  contractnumber: string | null;
  roomnumber: string | null;
  created_at: string;
  updated_at: string;
  lead_phone?: string;
  lead_wechat?: string;
  lead_source?: string;
  lead_status?: string;
  lead_type?: string;
  invalid?: boolean; // 是否无效（回退/作废）
  interviewsales?: string; // 面试销售
  interviewsales_user_id?: number; // 面试销售用户ID
  channel?: string; // 渠道
}

export interface DealFilters {
  id?: string[];
  leadid?: string[];
  contractdate_start?: string;
  contractdate_end?: string;
  community?: string[];
  contractnumber?: string[];
  roomnumber?: string[];
  interviewsales?: string[];
  channel?: string[];
  created_at_start?: string;
  created_at_end?: string;
  source?: string[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

// 获取成交记录列表（支持多字段筛选）
export async function getDeals(filters: DealFilters = {}) {
  const { data, error } = await supabase.rpc('filter_deals', {
    p_id: filters.id,
    p_leadid: filters.leadid,
    p_contractdate_start: filters.contractdate_start,
    p_contractdate_end: filters.contractdate_end,
    p_community: filters.community,
    p_contractnumber: filters.contractnumber,
    p_roomnumber: filters.roomnumber,
    p_created_at_start: filters.created_at_start,
    p_created_at_end: filters.created_at_end,
    p_source: filters.source,
    p_order_by: filters.orderBy || 'created_at',
    p_ascending: filters.ascending || false,
    p_limit: filters.limit || 10,
    p_offset: filters.offset || 0
  });
  
  if (error) throw error;
  return data;
}

// 获取成交记录总数（用于分页）
export async function getDealsCount(filters: DealFilters = {}) {
  const { data, error } = await supabase.rpc('get_deals_count', {
    p_id: filters.id,
    p_leadid: filters.leadid,
    p_contractdate_start: filters.contractdate_start,
    p_contractdate_end: filters.contractdate_end,
    p_community: filters.community,
    p_contractnumber: filters.contractnumber,
    p_roomnumber: filters.roomnumber,
    p_created_at_start: filters.created_at_start,
    p_created_at_end: filters.created_at_end,
    p_source: filters.source
  });
  
  if (error) throw error;
  return data || 0;
}

// 获取社区枚举值
export async function getDealsCommunityOptions() {
  const { data, error } = await supabase.rpc('get_enum_values', {
    enum_name: 'community'
  });
  if (error) throw error;
  return data || [];
}

// 获取来源枚举值（渠道）
export async function getDealsSourceOptions() {
  const { data, error } = await supabase.rpc('get_enum_values', {
    enum_name: 'source'
  });
  if (error) throw error;
  return data || [];
}

// 获取合同编号枚举值
export async function getDealsContractNumberOptions() {
  const { data, error } = await supabase.rpc('get_deals_contractnumber_options');
  if (error) throw error;
  return data || [];
}

// 获取房间编号枚举值
export async function getDealsRoomNumberOptions() {
  const { data, error } = await supabase.rpc('get_deals_roomnumber_options');
  if (error) throw error;
  return data || [];
}

// 创建成交记录
export async function createDeal(dealData: Partial<Deal>) {
  const { data, error } = await supabase
    .from('deals')
    .insert([dealData])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 更新成交记录
export async function updateDeal(id: string, dealData: Partial<Deal>) {
  const { data, error } = await supabase
    .from('deals')
    .update(dealData)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 删除成交记录
export async function deleteDeal(id: string) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 获取可用的线索编号选项（从跟进记录中获取）
export async function getAvailableLeadIds() {
  const { data, error } = await supabase
    .from('followups')
    .select('leadid')
    .not('leadid', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueLeadIds = [...new Set(data.map(item => item.leadid))];
  return uniqueLeadIds.map(leadid => ({ value: leadid, label: leadid }));
} 