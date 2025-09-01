import { MetroService } from './MetroService';
import { MetroConfigService } from './MetroConfigService';
import { MetroCacheService } from './MetroCacheService';
import type { DistanceResult, MetroStation } from '../utils/metroDistanceCalculator';

/**
 * 地铁服务协调器
 * 整合所有地铁相关服务，提供统一的接口
 */
export class MetroServiceCoordinator {
  private static instance: MetroServiceCoordinator;
  private metroService: MetroService;
  private configService: MetroConfigService;
  private cacheService: MetroCacheService;

  private constructor() {
    this.metroService = MetroService.getInstance();
    this.configService = MetroConfigService.getInstance();
    this.cacheService = MetroCacheService.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MetroServiceCoordinator {
    if (!MetroServiceCoordinator.instance) {
      MetroServiceCoordinator.instance = new MetroServiceCoordinator();
    }
    return MetroServiceCoordinator.instance;
  }

  /**
   * 计算通勤信息（带缓存）
   */
  public async calculateCommuteWithCache(
    fromStation: string, 
    toStation: string
  ): Promise<DistanceResult | null> {
    try {
      // 检查缓存
      if (this.cacheService.isEnabled()) {
        const cachedResult = this.cacheService.getCachedCommuteResult(fromStation, toStation);
        if (cachedResult) {
          console.log('使用缓存结果:', fromStation, '→', toStation);
          return cachedResult;
        }
      }

      // 计算新结果
      const result = this.metroService.calculateCommute(fromStation, toStation);
      
      if (result && this.cacheService.isEnabled()) {
        // 缓存结果
        this.cacheService.cacheCommuteResult(fromStation, toStation, result);
      }

      return result;
    } catch (error) {
      console.error('计算通勤信息时出错:', error);
      return null;
    }
  }

  /**
   * 批量计算通勤信息
   */
  public async batchCalculateCommute(
    routes: Array<{ from: string; to: string }>
  ): Promise<Array<{ route: { from: string; to: string }; result: DistanceResult | null }>> {
    const results = [];

    for (const route of routes) {
      const result = await this.calculateCommuteWithCache(route.from, route.to);
      results.push({
        route,
        result
      });
    }

    return results;
  }

  /**
   * 智能搜索站点
   */
  public searchStations(query: string): MetroStation[] {
    try {
      const maxResults = this.configService.get('maxSearchResults');
      const results = this.metroService.searchStations(query);
      
      // 限制搜索结果数量
      return results.slice(0, maxResults as number);
    } catch (error) {
      console.error('搜索站点时出错:', error);
      return [];
    }
  }

  /**
   * 获取站点信息
   */
  public getStationInfo(stationName: string): {
    station: MetroStation | null;
    lines: string[];
    isTransfer: boolean;
  } {
    try {
      const station = this.metroService.findStation(stationName);
      if (!station) {
        return {
          station: null,
          lines: [],
          isTransfer: false
        };
      }

      const lines = this.metroService.getStationLines(station);
      const isTransfer = this.metroService.isTransferStation(station.title);

      return {
        station,
        lines,
        isTransfer
      };
    } catch (error) {
      console.error('获取站点信息时出错:', error);
      return {
        station: null,
        lines: [],
        isTransfer: false
      };
    }
  }

  /**
   * 获取线路信息
   */
  public getLineInfo(lineName: string): {
    stations: string[];
    transferStations: string[];
  } {
    try {
      const stations = this.metroService.getStationsByLine(lineName);
      const transferStations = stations.filter(station => 
        this.metroService.isTransferStation(station)
      );

      return {
        stations,
        transferStations
      };
    } catch (error) {
      console.error('获取线路信息时出错:', error);
      return {
        stations: [],
        transferStations: []
      };
    }
  }

  /**
   * 获取系统统计信息
   */
  public getSystemStats(): {
    totalStations: number;
    totalLines: number;
    transferStations: number;
    cacheStats: ReturnType<MetroCacheService['getCacheStats']>;
    config: ReturnType<MetroConfigService['getAllConfig']>;
  } {
    try {
      const totalStations = this.metroService.getAllStations().length;
      const totalLines = this.metroService.getAllLineNames().length;
      const transferStations = this.metroService.getTransferStations().size;
      const cacheStats = this.cacheService.getCacheStats();
      const config = this.configService.getAllConfig();

      return {
        totalStations,
        totalLines,
        transferStations,
        cacheStats,
        config
      };
    } catch (error) {
      console.error('获取系统统计信息时出错:', error);
      return {
        totalStations: 0,
        totalLines: 0,
        transferStations: 0,
        cacheStats: {
          totalItems: 0,
          totalSize: 0,
          hitRate: 0,
          missRate: 0
        },
        config: {} as any
      };
    }
  }

  /**
   * 预加载常用数据
   */
  public async preloadCommonData(): Promise<void> {
    try {
      // 预加载常用路线
      this.cacheService.preloadCommonRoutes();

      // 预加载换乘站点信息
      const transferStations = this.metroService.getTransferStations();
      console.log('预加载换乘站点信息:', transferStations.size, '个站点');

      // 预加载线路信息
      const lineNames = this.metroService.getAllLineNames();
      console.log('预加载线路信息:', lineNames.length, '条线路');

    } catch (error) {
      console.error('预加载数据时出错:', error);
    }
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.cacheService.clear();
  }

  /**
   * 重置配置
   */
  public resetConfig(): void {
    this.configService.resetToDefault();
  }

  /**
   * 更新配置
   */
  public updateConfig(key: string, value: any): void {
    this.configService.set(key as any, value);
  }

  /**
   * 获取配置
   */
  public getConfig<T>(key: string): T {
    return this.configService.get(key as any);
  }

  /**
   * 检查服务状态
   */
  public checkServiceHealth(): {
    metroService: boolean;
    configService: boolean;
    cacheService: boolean;
  } {
    try {
      const metroService = this.metroService !== null;
      const configService = this.configService !== null;
      const cacheService = this.cacheService !== null;

      return {
        metroService,
        configService,
        cacheService
      };
    } catch (error) {
      return {
        metroService: false,
        configService: false,
        cacheService: false
      };
    }
  }

  /**
   * 获取推荐路线
   */
  public getRecommendedRoutes(fromStation: string): Array<{
    toStation: string;
    reason: string;
    estimatedTime: number;
  }> {
    try {
      const recommendations = [
        { toStation: '人民广场', reason: '市中心核心区域', estimatedTime: 15 },
        { toStation: '徐家汇', reason: '商业繁华区域', estimatedTime: 20 },
        { toStation: '陆家嘴', reason: '金融中心区域', estimatedTime: 25 },
        { toStation: '虹桥火车站', reason: '交通枢纽', estimatedTime: 30 },
        { toStation: '浦东1号2号航站楼', reason: '机场交通', estimatedTime: 45 },
      ];

      // 过滤掉起始站
      return recommendations.filter(rec => rec.toStation !== fromStation);
    } catch (error) {
      console.error('获取推荐路线时出错:', error);
      return [];
    }
  }
}

/**
 * 服务协调器工厂
 */
export class MetroServiceCoordinatorFactory {
  /**
   * 创建服务协调器实例
   */
  public static createCoordinator(): MetroServiceCoordinator {
    return MetroServiceCoordinator.getInstance();
  }

  /**
   * 创建测试用的服务协调器实例
   */
  public static createTestCoordinator(): MetroServiceCoordinator {
    return MetroServiceCoordinator.getInstance();
  }
}
