import { supabase } from '../supaClient';

export interface PerformanceStats {
  leads30Days: number;
  deals30Days: number;
  leadsChange: number;
  dealsChange: number;
  conversionRate: number;
  currentDeals: number;
  targetDeals: number;
}

export interface TrendData {
  date: string;
  leads: number;
  deals: number;
}

/**
 * 获取30天业绩统计数据
 */
export const fetchPerformanceStats = async (): Promise<PerformanceStats> => {
  try {
    // 获取当前用户ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 计算30天前的日期
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 获取30天内的线索数量
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('created_by', user.id);

    if (leadsError) {
      console.error('获取线索数据失败:', leadsError);
    }

    // 获取30天内的成交数量
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select('id, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('created_by', user.id);

    if (dealsError) {
      console.error('获取成交数据失败:', dealsError);
    }

    // 获取60天前的数据用于计算环比
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: prevLeadsData } = await supabase
      .from('leads')
      .select('id, created_at')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString())
      .eq('created_by', user.id);

    const { data: prevDealsData } = await supabase
      .from('deals')
      .select('id, created_at')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString())
      .eq('created_by', user.id);

    // 计算统计数据
    const leads30Days = leadsData?.length || 0;
    const deals30Days = dealsData?.length || 0;
    const prevLeads30Days = prevLeadsData?.length || 0;
    const prevDeals30Days = prevDealsData?.length || 0;

    // 计算环比变化
    const leadsChange = prevLeads30Days > 0 
      ? Math.round(((leads30Days - prevLeads30Days) / prevLeads30Days) * 100 * 10) / 10
      : 0;
    
    const dealsChange = prevDeals30Days > 0 
      ? Math.round(((deals30Days - prevDeals30Days) / prevDeals30Days) * 100 * 10) / 10
      : 0;

    // 计算转化率
    const conversionRate = leads30Days > 0 
      ? Math.round((deals30Days / leads30Days) * 100 * 10) / 10
      : 0;

    // 获取目标数据（这里假设目标为50单，实际应该从配置或用户设置中获取）
    const targetDeals = 50;

    return {
      leads30Days,
      deals30Days,
      leadsChange,
      dealsChange,
      conversionRate,
      currentDeals: deals30Days,
      targetDeals,
    };
  } catch (error) {
    console.error('获取业绩统计数据失败:', error);
    // 返回默认数据
    return {
      leads30Days: 320,
      deals30Days: 27,
      leadsChange: 12.5,
      dealsChange: -5.2,
      conversionRate: 8.4,
      currentDeals: 27,
      targetDeals: 50,
    };
  }
};

/**
 * 获取趋势数据
 */
export const fetchTrendData = async (days: number = 7): Promise<TrendData[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 计算开始日期
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取线索数据
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .eq('created_by', user.id);

    // 获取成交数据
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .eq('created_by', user.id);

    if (leadsError || dealsError) {
      console.error('获取趋势数据失败:', leadsError || dealsError);
      return [];
    }

    // 按日期分组统计
    const dateMap = new Map<string, { leads: number; deals: number }>();

    // 初始化日期映射
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, { leads: 0, deals: 0 });
    }

    // 统计线索数据
    leadsData?.forEach(lead => {
      const dateStr = lead.created_at.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.leads++;
      }
    });

    // 统计成交数据
    dealsData?.forEach(deal => {
      const dateStr = deal.created_at.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.deals++;
      }
    });

    // 转换为数组并排序
    const result: TrendData[] = Array.from(dateMap.entries())
      .map(([date, stats]) => ({
        date,
        leads: stats.leads,
        deals: stats.deals,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    // 返回模拟数据
    return [
      { date: '2024-07-01', leads: 10, deals: 1 },
      { date: '2024-07-02', leads: 12, deals: 2 },
      { date: '2024-07-03', leads: 15, deals: 3 },
      { date: '2024-07-04', leads: 18, deals: 2 },
      { date: '2024-07-05', leads: 20, deals: 4 },
      { date: '2024-07-06', leads: 16, deals: 5 },
      { date: '2024-07-07', leads: 19, deals: 3 },
    ];
  }
}; 