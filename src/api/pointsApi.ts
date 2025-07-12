import { supabase } from '../supaClient';

// 获取当前登录用户的 users_profile int8 id
export async function getCurrentProfileId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('users_profile')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (error) return null;
  return data.id;
}

// 获取用户积分信息
export async function getUserPointsInfo(userId: number) {
  const { data, error } = await supabase.rpc('get_user_points_info', { p_user_id: userId });
  if (error) throw error;
  return data;
}

// 积分发放
export async function awardPoints(userId: number, sourceType: string, sourceId?: number, description?: string) {
  const { data, error } = await supabase.rpc('award_points', {
    p_user_id: userId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_description: description
  });
  if (error) throw error;
  return data;
}

// 积分兑换
export async function exchangePoints(userId: number, exchangeType: string, targetId: number, pointsRequired: number, description?: string) {
  const { data, error } = await supabase.rpc('exchange_points', {
    p_user_id: userId,
    p_exchange_type: exchangeType,
    p_target_id: targetId,
    p_points_required: pointsRequired,
    p_description: description
  });
  if (error) throw error;
  return data;
}

// 获取积分规则
export async function getPointsRules() {
  const { data, error } = await supabase
    .from('points_rules')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// 筛选积分明细
export async function filterPointsTransactions(userId: number, filters: Record<string, any> = {}) {
  let query = supabase
    .from('user_points_transactions')
    .select('*')
    .eq('user_id', userId);

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

// 筛选兑换记录
export async function filterExchangeRecords(userId: number, filters: Record<string, any> = {}) {
  let query = supabase
    .from('points_exchange_records')
    .select('*')
    .eq('user_id', userId);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && !['orderBy', 'ascending', 'limit', 'offset'].includes(key)) {
      query = query.eq(key, value);
    }
  });

  if (filters.orderBy) {
    query = query.order(filters.orderBy, { ascending: !!filters.ascending });
  } else {
    query = query.order('exchange_time', { ascending: false });
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

// 获取兑换记录
export async function getExchangeRecords(userId: number) {
  const { data, error } = await supabase
    .from('points_exchange_records')
    .select('*')
    .eq('user_id', userId)
    .order('exchange_time', { ascending: false });
  if (error) throw error;
  return data;
} 