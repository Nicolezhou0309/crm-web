import { supabase } from '../supaClient';
import { MetroService } from './MetroService';
import { MetroCommuteService } from './MetroCommuteService';
import type { SupabaseCommuteResult } from './MetroCommuteService';

/**
 * 前端通勤时间计算服务
 * 与数据库函数保持相同的返回格式，用于测试和替代方案
 */
export class FrontendCommuteCalculationService {
  private static instance: FrontendCommuteCalculationService;
  private metroService: MetroService;
  private metroCommuteService: MetroCommuteService;

  public static getInstance(): FrontendCommuteCalculationService {
    if (!FrontendCommuteCalculationService.instance) {
      FrontendCommuteCalculationService.instance = new FrontendCommuteCalculationService();
    }
    return FrontendCommuteCalculationService.instance;
  }

  constructor() {
    this.metroService = MetroService.getInstance();
    this.metroCommuteService = MetroCommuteService.getInstance();
  }

  /**
   * 前端计算通勤时间（与数据库函数格式一致）
   * 对应数据库函数：calculate_metro_commute_time
   */
  async calculateMetroCommuteTime(
    p_start_station: string,
    p_end_station: string
  ): Promise<SupabaseCommuteResult> {
    try {
      console.log('🚇 [前端计算] 开始计算通勤时间:', p_start_station, '→', p_end_station);

      // 验证参数
      if (!p_start_station || !p_end_station) {
        return {
          success: false,
          start_station: p_start_station || '',
          end_station: p_end_station || '',
          total_time_minutes: 999,
          total_time_formatted: '999分钟',
          stations_count: 0,
          path: [],
          transfers: [],
          transfer_count: 0,
          route_summary: '参数错误',
          error: '起始站和终点站不能为空'
        };
      }

      // 如果两个站点相同
      if (p_start_station === p_end_station) {
        return {
          success: true,
          start_station: p_start_station,
          end_station: p_end_station,
          total_time_minutes: 0,
          total_time_formatted: '0分钟',
          stations_count: 0,
          path: [p_start_station],
          transfers: [],
          transfer_count: 0,
          route_summary: '无需移动'
        };
      }

      // 使用现有的MetroService计算通勤信息
      const commuteInfo = this.metroService.calculateCommute(
        p_start_station,
        p_end_station
      );

      if (!commuteInfo) {
        return {
          success: false,
          start_station: p_start_station,
          end_station: p_end_station,
          total_time_minutes: 999,
          total_time_formatted: '999分钟',
          stations_count: 0,
          path: [],
          transfers: [],
          transfer_count: 0,
          route_summary: '计算失败',
          error: '无法计算通勤路径'
        };
      }

      // 转换为数据库函数格式
      const result: SupabaseCommuteResult = {
        success: true,
        start_station: commuteInfo.fromStation.title,
        end_station: commuteInfo.toStation.title,
        total_time_minutes: commuteInfo.commuteTime,
        total_time_formatted: this.formatTime(commuteInfo.commuteTime),
        stations_count: commuteInfo.stationCount,
        path: commuteInfo.route.map(station => station.title),
        transfers: commuteInfo.transfers,
        transfer_count: commuteInfo.transferCount,
        route_summary: commuteInfo.routeSummary
      };

      console.log('✅ [前端计算] 通勤时间计算成功:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [前端计算] 通勤时间计算失败:', error);
      return {
        success: false,
        start_station: p_start_station,
        end_station: p_end_station,
        total_time_minutes: 999,
        total_time_formatted: '999分钟',
        stations_count: 0,
        path: [],
        transfers: [],
        transfer_count: 0,
        route_summary: '计算异常',
        error: error.message || '未知错误'
      };
    }
  }

  /**
   * 前端批量计算社区通勤时间（优化版本：前端遍历，数据库点对点计算）
   * 对应数据库函数：batch_calculate_community_commute_times
   */
  async batchCalculateCommunityCommuteTimes(
    p_worklocation: string,
    p_followup_id: string,
    options?: {
      maxCommunities?: number;
      onProgress?: (current: number, total: number, community: string) => void;
      onComplete?: (result: Record<string, number>) => void;
    }
  ): Promise<{ success: boolean; commute_times: Record<string, number>; calculated_count: number; message?: string; error?: string }> {
    try {
      console.log('🚇 [前端批量计算] 开始批量计算通勤时间:', p_worklocation, '→', p_followup_id);

      // 获取社区数据
      const { data: communities, error: communitiesError } = await supabase
        .from('community_keywords')
        .select('community, metrostation')
        .not('metrostation', 'is', null);

      if (communitiesError) {
        throw new Error(`获取社区数据失败: ${communitiesError.message}`);
      }

      if (!communities || communities.length === 0) {
        return {
          success: true,
          commute_times: {},
          calculated_count: 0,
          message: '没有找到社区数据，跳过通勤时间计算'
        };
      }

      // 限制计算数量（避免前端计算时间过长）
      const maxCommunities = options?.maxCommunities || 20;
      const limitedCommunities = communities.slice(0, maxCommunities);
      
      console.log(`📊 [前端批量计算] 共找到 ${communities.length} 个社区，限制计算前 ${limitedCommunities.length} 个`);

      const commuteTimes: Record<string, number> = {};
      let calculatedCount = 0;
      const startTime = Date.now();

      // 🆕 优化版本：前端遍历，数据库点对点计算
      for (const community of limitedCommunities) {
        try {
          // 调用进度回调
          options?.onProgress?.(calculatedCount + 1, limitedCommunities.length, community.community);

          // 🆕 使用数据库点对点计算，避免前端计算复杂的地铁路径
          const { data: result, error } = await supabase.rpc('calculate_metro_commute_time', {
            p_start_station: p_worklocation,
            p_end_station: community.metrostation
          });

          if (error) {
            console.error(`数据库计算${p_worklocation}到${community.metrostation}通勤时间失败:`, error);
            commuteTimes[community.community] = 999;
          } else if (result && result.success) {
            commuteTimes[community.community] = result.total_time_minutes;
            console.log(`✅ [数据库计算] ${p_worklocation} → ${community.metrostation}: ${result.total_time_minutes}分钟`);
          } else {
            console.warn(`数据库计算${p_worklocation}到${community.metrostation}返回失败:`, result);
            commuteTimes[community.community] = 999;
          }
          
          calculatedCount++;

          // 每计算5个社区记录一次进度
          if (calculatedCount % 5 === 0) {
            const elapsed = Date.now() - startTime;
            console.log(`📊 [前端批量计算] 已计算 ${calculatedCount}/${limitedCommunities.length} 个社区，耗时: ${elapsed}ms`);
          }

          // 添加小延迟，避免数据库请求过于密集
          if (calculatedCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error) {
          console.error(`计算${p_worklocation}到${community.metrostation}通勤时间失败:`, error);
          commuteTimes[community.community] = 999;
          calculatedCount++;
        }
      }

      // 调用完成回调
      options?.onComplete?.(commuteTimes);

      // 🆕 移除重复的数据库保存逻辑，由调用方统一处理
      // 这样可以避免数据不一致和重复保存的问题

      const totalTime = Date.now() - startTime;
      console.log('✅ [前端批量计算] 批量计算完成:', {
        calculatedCount,
        commuteTimesCount: Object.keys(commuteTimes).length,
        totalTime: `${totalTime}ms`,
        averageTime: `${Math.round(totalTime / calculatedCount)}ms/社区`
      });

      return {
        success: true,
        commute_times: commuteTimes,
        calculated_count: calculatedCount,
        message: '通勤时间计算成功'
      };

    } catch (error: any) {
      console.error('❌ [前端批量计算] 批量计算失败:', error);
      return {
        success: false,
        commute_times: {},
        calculated_count: 0,
        error: error.message || '未知错误'
      };
    }
  }

  /**
   * 前端计算通勤时间（简化版本，对应数据库函数：calculate_commute_times_for_worklocation）
   */
  async calculateCommuteTimesForWorklocation(
    p_followup_id: string,
    p_worklocation: string,
    options?: {
      maxCommunities?: number;
      onProgress?: (current: number, total: number, community: string) => void;
      onComplete?: (result: Record<string, number>) => void;
    }
  ): Promise<{ success: boolean; message?: string; commute_times?: Record<string, number>; communities_count?: number; error?: string }> {
    try {
      console.log('🚇 [前端计算] 开始计算工作地点通勤时间:', p_worklocation, '→', p_followup_id);

      // 调用批量计算函数
      const result = await this.batchCalculateCommunityCommuteTimes(p_worklocation, p_followup_id, options);

      if (result.success) {
        return {
          success: true,
          message: '通勤时间计算成功',
          commute_times: result.commute_times,
          communities_count: result.calculated_count
        };
      } else {
        return {
          success: false,
          error: result.error || result.message
        };
      }

    } catch (error: any) {
      console.error('❌ [前端计算] 工作地点通勤时间计算失败:', error);
      return {
        success: false,
        error: error.message || '未知错误'
      };
    }
  }

  /**
   * 格式化时间显示
   */
  private formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`;
  }

  /**
   * 获取所有地铁站数据（用于测试）
   */
  async getMetroStations(): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_metrostations');
      if (error) {
        console.error('获取地铁站数据失败:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('获取地铁站数据异常:', error);
      return [];
    }
  }

  /**
   * 获取社区数据（用于测试）
   */
  async getCommunities(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('community_keywords')
        .select('community, metrostation')
        .not('metrostation', 'is', null);
      
      if (error) {
        console.error('获取社区数据失败:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('获取社区数据异常:', error);
      return [];
    }
  }
}

export default FrontendCommuteCalculationService;
