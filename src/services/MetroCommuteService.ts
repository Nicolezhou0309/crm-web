import { supabase } from '../supaClient';

export interface MetroRoute {
  startStation: string;
  endStation: string;
  totalTime: number;
  stationsCount: number;
  transferCount: number;
  path: string[];
  transfers: TransferInfo[];
  routeSummary: string;
}

export interface TransferInfo {
  station: string;
  fromLine: string;
  toLine: string;
}

export interface SupabaseCommuteResult {
  success: boolean;
  start_station: string;
  end_station: string;
  total_time_minutes: number;
  total_time_formatted: string;
  stations_count: number;
  path: string[];
  transfers: TransferInfo[];
  transfer_count: number;
  route_summary: string;
  error?: string;
}

export class MetroCommuteService {
  private static instance: MetroCommuteService;
  private metroData: any = null;

  public static getInstance(): MetroCommuteService {
    if (!MetroCommuteService.instance) {
      MetroCommuteService.instance = new MetroCommuteService();
    }
    return MetroCommuteService.instance;
  }

  /**
   * 初始化地铁数据
   */
  async initialize(): Promise<void> {
    if (this.metroData) return;

    try {
      // 从数据库获取地铁站数据
      const { data, error } = await supabase.rpc('get_metrostations');
      if (error) {
        console.error('获取地铁站数据失败:', error);
        return;
      }
      this.metroData = data;
    } catch (error) {
      console.error('初始化地铁服务失败:', error);
    }
  }

  /**
   * 计算两个地铁站之间的通勤时间（绑定到Supabase算法）
   */
  async calculateCommuteTime(startStation: string, endStation: string): Promise<number> {
    if (!startStation || !endStation) return 999;
    
    // 如果两个站点相同，返回0
    if (startStation === endStation) return 0;

    try {
      // 解析工作地点参数，提取站点名称
      const parsedStartStation = this.parseStationName(startStation);
      const parsedEndStation = this.parseStationName(endStation);
      
      // 调用Supabase的Dijkstra算法计算通勤时间
      const result = await this.callSupabaseMetroCalculator(parsedStartStation, parsedEndStation);
      
      if (result && result.success) {
        return result.total_time_minutes;
      } else {
        console.warn('Supabase算法计算失败，使用备用方案:', result?.error);
        return this.getSimulatedCommuteTime(parsedStartStation, parsedEndStation);
      }
    } catch (error) {
      console.error('计算通勤时间失败:', error);
      // 返回模拟值
      return this.getSimulatedCommuteTime(startStation, endStation);
    }
  }

  /**
   * 解析站点名称，提取纯站点名称（去除线路信息）
   */
  private parseStationName(stationName: string): string {
    if (!stationName) return '';
    
    // 如果包含"/"，取后面的部分（站点名称）
    if (stationName.includes('/')) {
      const parts = stationName.split('/');
      return parts[parts.length - 1].trim();
    }
    
    // 如果包含"号线"，取前面的部分
    if (stationName.includes('号线')) {
      const parts = stationName.split('号线');
      return parts[0].trim();
    }
    
    return stationName.trim();
  }

  /**
   * 根据线路号获取默认站点（备用方案）
   * @param lineNumber 线路号
   * @returns 默认站点名称
   */
  private getDefaultStationForLine(lineNumber: string): string | null {
    // 预定义的线路默认站点映射
    const lineDefaultStations: Record<string, string> = {
      '1': '人民广场',
      '2': '人民广场',
      '3': '人民广场',
      '4': '人民广场',
      '5': '莘庄',
      '6': '东方体育中心',
      '7': '美兰湖',
      '8': '沈杜公路',
      '9': '松江南站',
      '10': '新江湾城',
      '11': '迪士尼',
      '12': '七莘路',
      '13': '金运路',
      '16': '龙阳路',
      '17': '虹桥火车站',
      '18': '长江南路'
    };
    
    return lineDefaultStations[lineNumber] || null;
  }

  /**
   * 获取完整的通勤信息（包含路径、换乘等详细信息）
   */
  async calculateCommuteInfo(startStation: string, endStation: string): Promise<MetroRoute | null> {
    if (!startStation || !endStation) return null;
    
    // 如果两个站点相同，返回空路径
    if (startStation === endStation) {
      return {
        startStation,
        endStation,
        totalTime: 0,
        stationsCount: 0,
        transferCount: 0,
        path: [startStation],
        transfers: [],
        routeSummary: '无需移动'
      };
    }

    try {
      // 解析工作地点参数，提取站点名称
      const parsedStartStation = this.parseStationName(startStation);
      const parsedEndStation = this.parseStationName(endStation);
      
      // 调用Supabase的Dijkstra算法获取完整信息
      const result = await this.callSupabaseMetroCalculator(parsedStartStation, parsedEndStation);
      
      if (result && result.success) {
        return {
          startStation: result.start_station,
          endStation: result.end_station,
          totalTime: result.total_time_minutes,
          stationsCount: result.stations_count,
          transferCount: result.transfer_count,
          path: result.path,
          transfers: result.transfers,
          routeSummary: result.route_summary
        };
      } else {
        console.warn('Supabase算法计算失败:', result?.error);
        return null;
      }
    } catch (error) {
      console.error('获取通勤信息失败:', error);
      return null;
    }
  }

  /**
   * 调用Supabase的Dijkstra算法（带超时控制）
   */
  private async callSupabaseMetroCalculatorWithTimeout(startStation: string, endStation: string): Promise<SupabaseCommuteResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      console.log('🚇 调用Supabase Dijkstra算法:', startStation, '→', endStation);
      
      const { data, error } = await supabase.rpc('calculate_metro_commute_time', {
        p_start_station: startStation,
        p_end_station: endStation
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('Supabase RPC调用失败:', error);
        return null;
      }

      if (data) {
        console.log('✅ Supabase算法计算成功:', data);
        return data as SupabaseCommuteResult;
      }

      return null;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn('⏰ 请求超时:', startStation, '→', endStation);
      } else {
        console.error('调用Supabase算法失败:', error);
      }
      
      return null;
    }
  }

  /**
   * 调用Supabase的Dijkstra算法（主要方法，带重试）
   */
  private async callSupabaseMetroCalculator(startStation: string, endStation: string): Promise<SupabaseCommuteResult | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.callSupabaseMetroCalculatorWithTimeout(startStation, endStation);
        if (result) return result;
        
        if (attempt < 2) {
          console.log(`🔄 第${attempt}次尝试失败，等待后重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error: any) {
        console.error(`第${attempt}次尝试失败:`, error);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    console.warn(`❌ 经过2次尝试后仍然失败:`, startStation, '→', endStation);
    return null;
  }

  /**
   * 获取模拟通勤时间（备用方案）
   */
  private getSimulatedCommuteTime(startStation: string, endStation: string): number {
    // 基于已知的站点关系返回模拟值（仅作为备用）
    const stationPairs: Record<string, number> = {
      '人民广场-浦江镇': 45,
      '人民广场-万科城市花园站': 35,
      '人民广场-华润城站': 28,
      '徐家汇-浦江镇': 38,
      '徐家汇-万科城市花园站': 28,
      '徐家汇-华润城站': 21,
      '陆家嘴-浦江镇': 52,
      '陆家嘴-万科城市花园站': 42,
      '陆家嘴-华润城站': 35
    };

    const key = `${startStation}-${endStation}`;
    const reverseKey = `${endStation}-${startStation}`;
    
    return stationPairs[key] || stationPairs[reverseKey] || 50;
  }

  /**
   * 获取地铁站列表
   */
  async getMetroStations(): Promise<any[]> {
    if (!this.metroData) {
      await this.initialize();
    }
    return this.metroData || [];
  }

  /**
   * 搜索地铁站
   */
  async searchMetroStations(query: string): Promise<any[]> {
    const stations = await this.getMetroStations();
    if (!query) return stations;
    
    return stations.filter(station => 
      station.name.includes(query) || 
      station.line.includes(query)
    );
  }

  /**
   * 获取站点所属线路
   */
  async getStationLines(stationName: string): Promise<string[]> {
    const stations = await this.getMetroStations();
    return stations
      .filter(station => station.name === stationName)
      .map(station => station.line);
  }

  /**
   * 检查是否为换乘站
   */
  async isTransferStation(stationName: string): Promise<boolean> {
    const lines = await this.getStationLines(stationName);
    return lines.length > 1;
  }

  /**
   * 批量计算通勤时间（用于社区推荐）
   */
  async batchCalculateCommuteTimes(worklocation: string, metrostations: string[]): Promise<Record<string, number>> {
    const commuteTimes: Record<string, number> = {};
    
    for (const metrostation of metrostations) {
      try {
        const time = await this.calculateCommuteTime(worklocation, metrostation);
        commuteTimes[metrostation] = time;
      } catch (error) {
        console.error(`计算${worklocation}到${metrostation}通勤时间失败:`, error);
        commuteTimes[metrostation] = 999; // 默认值
      }
    }
    
    return commuteTimes;
  }
}

export default MetroCommuteService;
