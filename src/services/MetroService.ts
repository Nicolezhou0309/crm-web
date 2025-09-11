import type {
  MetroStation,
  DistanceResult
} from '../utils/metroDistanceCalculator';
import {
  METRO_LINES_DATA,
  SHANGHAI_METRO_STATIONS
} from '../utils/metroDistanceCalculator';
import MetroDataService from './MetroDataService';
import { EnumDataService } from '../components/Followups/services/EnumDataService';

/**
 * 地铁服务类
 * 封装所有地铁相关的计算逻辑和业务规则
 */
export class MetroService {
  private static instance: MetroService;
  private transferStations!: Map<string, string[]>;
  private stationToLines!: Map<string, string[]>;
  private metroDataService: MetroDataService;
  private enumDataService: EnumDataService;
  private dynamicStations: MetroStation[] = [];

  private constructor() {
    this.metroDataService = MetroDataService.getInstance();
    this.enumDataService = new EnumDataService();
    this.initializeMappings();
    this.initializeDynamicStations();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MetroService {
    if (!MetroService.instance) {
      MetroService.instance = new MetroService();
    }
    return MetroService.instance;
  }

  /**
   * 初始化换乘站点映射
   */
  private initializeMappings(): void {
    this.transferStations = new Map<string, string[]>();
    this.stationToLines = new Map<string, string[]>();

    // 初始化站点到线路的映射
    Object.entries(METRO_LINES_DATA).forEach(([lineName, stations]) => {
      stations.forEach((station: string) => {
        if (!this.stationToLines.has(station)) {
          this.stationToLines.set(station, []);
        }
        this.stationToLines.get(station)!.push(lineName);
      });
    });

    // 找出换乘站点
    this.stationToLines.forEach((lines, station) => {
      if (lines.length > 1) {
        this.transferStations.set(station, lines);
      }
    });
  }

  /**
   * 初始化动态站点数据（优先使用EnumDataService）
   */
  private async initializeDynamicStations(): Promise<void> {
    try {
      // 优先使用EnumDataService获取数据
      const { data, error } = await this.enumDataService.getMetroStationsFormatted();
      
      if (error) {
        console.warn('⚠️ [MetroService] EnumDataService获取失败，回退到MetroDataService:', error);
        this.dynamicStations = await this.metroDataService.getAllStations();
      } else if (data && data.length > 0) {
        this.dynamicStations = data;
        console.log(`✅ [MetroService] 通过EnumDataService动态加载了 ${this.dynamicStations.length} 个地铁站点`);
      } else {
        console.warn('⚠️ [MetroService] EnumDataService返回空数据，回退到MetroDataService');
        this.dynamicStations = await this.metroDataService.getAllStations();
      }
      
      if (this.dynamicStations.length === 0) {
        console.warn('⚠️ [MetroService] 所有数据源都失败，使用静态数据作为备用');
        this.dynamicStations = SHANGHAI_METRO_STATIONS;
      }
    } catch (error) {
      console.error('❌ [MetroService] 初始化动态站点数据失败:', error);
      // 使用静态数据作为备用
      this.dynamicStations = SHANGHAI_METRO_STATIONS;
    }
  }

  /**
   * 计算两个站点之间的通勤信息
   */
  public calculateCommute(fromStationName: string, toStationName: string): DistanceResult | null {
    const fromStation = this.findStation(fromStationName);
    const toStation = this.findStation(toStationName);

    if (!fromStation || !toStation) {
      return null;
    }

    const distance = this.calculateDistance(fromStation, toStation);
    const routeInfo = this.planRoute(fromStation, toStation);

    return {
      fromStation,
      toStation,
      distance,
      commuteTime: routeInfo.totalTime,
      stationCount: routeInfo.stationCount,
      route: routeInfo.route,
      transfers: routeInfo.transfers,
      transferCount: routeInfo.transferCount,
      routeSummary: routeInfo.routeSummary
    };
  }

  /**
   * 查找站点（按名称或ID）
   */
  public findStation(query: string): MetroStation | null {
    const lowerQuery = query.toLowerCase();

    // 优先使用动态站点数据
    if (this.dynamicStations.length > 0) {
      // 先按名称精确匹配
      let station = this.dynamicStations.find(s =>
        s.title.toLowerCase() === lowerQuery
      );

      if (station) return station;

      // 按名称模糊匹配
      station = this.dynamicStations.find(s =>
        s.title.toLowerCase().includes(lowerQuery)
      );

      if (station) return station;

      // 按ID匹配
      station = this.dynamicStations.find(s =>
        s.id.toLowerCase().includes(lowerQuery)
      );

      if (station) return station;
    }

    // 如果动态数据中没有找到，使用静态数据作为备用
    let station = SHANGHAI_METRO_STATIONS.find(s =>
      s.title.toLowerCase() === lowerQuery
    );

    if (station) return station;

    // 按名称模糊匹配
    station = SHANGHAI_METRO_STATIONS.find(s =>
      s.title.toLowerCase().includes(lowerQuery)
    );

    if (station) return station;

    // 按ID匹配
    station = SHANGHAI_METRO_STATIONS.find(s =>
      s.id.toLowerCase().includes(lowerQuery)
    );

    return station || null;
  }

  /**
   * 获取站点所属线路
   */
  public getStationLines(station: MetroStation): string[] {
    return this.stationToLines.get(station.title) || [];
  }

  /**
   * 获取所有站点列表
   */
  public getAllStations(): MetroStation[] {
    // 优先返回动态站点数据，如果为空则返回静态数据
    return this.dynamicStations.length > 0 ? this.dynamicStations : SHANGHAI_METRO_STATIONS;
  }

  /**
   * 搜索站点（支持模糊搜索）
   */
  public searchStations(query: string): MetroStation[] {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return SHANGHAI_METRO_STATIONS.filter(station =>
      station.title.toLowerCase().includes(lowerQuery) ||
      station.description.toLowerCase().includes(lowerQuery) ||
      station.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取换乘站点列表
   */
  public getTransferStations(): Map<string, string[]> {
    return new Map(this.transferStations);
  }

  /**
   * 检查站点是否为换乘站
   */
  public isTransferStation(stationName: string): boolean {
    return this.transferStations.has(stationName);
  }

  /**
   * 获取指定线路的所有站点
   */
  public getStationsByLine(lineName: string): string[] {
    return METRO_LINES_DATA[lineName] || [];
  }

  /**
   * 获取所有线路名称
   */
  public getAllLineNames(): string[] {
    return Object.keys(METRO_LINES_DATA);
  }

  /**
   * 计算两个站点之间的欧几里得距离
   */
  private calculateDistance(station1: MetroStation, station2: MetroStation): number {
    const dx = station1.x - station2.x;
    const dy = station1.y - station2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 路线规划核心逻辑
   */
  private planRoute(fromStation: MetroStation, toStation: MetroStation) {
    const fromLines = this.getStationLines(fromStation);
    const toLines = this.getStationLines(toStation);

    // 检查是否在同一条线路上
    const commonLine = fromLines.find(line => toLines.includes(line));

    if (commonLine) {
      // 同一条线路，无需换乘
      const stations = METRO_LINES_DATA[commonLine];
      const fromIndex = stations.indexOf(fromStation.title);
      const toIndex = stations.indexOf(toStation.title);
      const stationCount = Math.abs(toIndex - fromIndex);

      return {
        totalTime: stationCount * 3,
        stationCount,
        route: [fromStation, toStation],
        transfers: [],
        transferCount: 0,
        routeSummary: `从 ${fromStation.title} 乘坐${commonLine}到 ${toStation.title}，无需换乘`
      };
    }

    // 需要换乘的情况
    const transferInfo = this.findBestTransfer(fromStation, toStation);

    return {
      totalTime: transferInfo.totalTime,
      stationCount: transferInfo.stationCount,
      route: transferInfo.route,
      transfers: transferInfo.transfers,
      transferCount: transferInfo.transferCount,
      routeSummary: transferInfo.routeSummary
    };
  }

  /**
   * 寻找最佳换乘方案
   */
  private findBestTransfer(fromStation: MetroStation, toStation: MetroStation) {
    const fromLines = this.getStationLines(fromStation);
    const toLines = this.getStationLines(toStation);

    let bestTransfer: any = null;
    let minTime = Infinity;

    // 尝试所有可能的换乘组合
    for (const fromLine of fromLines) {
      for (const toLine of toLines) {
        if (fromLine === toLine) continue;

        // 寻找换乘站点
        const transferStations = this.findTransferStations(fromLine, toLine);

        for (const transferStation of transferStations) {
          const transferInfo = this.calculateTransferRoute(
            fromStation,
            transferStation,
            toStation,
            fromLine,
            toLine
          );

          if (transferInfo.totalTime < minTime) {
            minTime = transferInfo.totalTime;
            bestTransfer = transferInfo;
          }
        }
      }
    }

    return bestTransfer || {
      totalTime: 999,
      stationCount: 999,
      route: [fromStation, toStation],
      transfers: [],
      transferCount: 0,
      routeSummary: `无法找到从 ${fromStation.title} 到 ${toStation.title} 的路线`
    };
  }

  /**
   * 查找两条线路之间的换乘站点
   */
  private findTransferStations(line1: string, line2: string): string[] {
    const stations1 = METRO_LINES_DATA[line1];
    const stations2 = METRO_LINES_DATA[line2];

    return stations1.filter(station => stations2.includes(station));
  }

  /**
   * 计算换乘路线
   */
  private calculateTransferRoute(
    fromStation: MetroStation,
    transferStation: string,
    toStation: MetroStation,
    fromLine: string,
    toLine: string
  ) {
    const stations1 = METRO_LINES_DATA[fromLine];
    const stations2 = METRO_LINES_DATA[toLine];

    const fromIndex = stations1.indexOf(fromStation.title);
    const transferIndex1 = stations1.indexOf(transferStation);
    const transferIndex2 = stations2.indexOf(transferStation);
    const toIndex = stations2.indexOf(toStation.title);

    const stations1Count = Math.abs(fromIndex - transferIndex1);
    const stations2Count = Math.abs(toIndex - transferIndex2);
    const totalStations = stations1Count + stations2Count;

    // 换乘时间：5分钟
    const transferTime = 5;
    const totalTime = totalStations * 3 + transferTime;

    return {
      totalTime,
      stationCount: totalStations,
      route: [fromStation, { ...fromStation, title: transferStation }, toStation],
      transfers: [{
        station: transferStation,
        fromLine,
        toLine
      }],
      transferCount: 1,
      routeSummary: `从 ${fromStation.title} 乘坐${fromLine}，在${transferStation}换乘${toLine}，到达${toStation.title}`
    };
  }
}

/**
 * 地铁服务工厂
 */
export class MetroServiceFactory {
  /**
   * 创建地铁服务实例
   */
  public static createService(): MetroService {
    return MetroService.getInstance();
  }

  /**
   * 创建测试用的地铁服务实例
   */
  public static createTestService(): MetroService {
    return MetroService.getInstance();
  }
}

/**
 * 地铁计算器接口
 */
export interface IMetroCalculator {
  calculateCommute(fromStation: string, toStation: string): DistanceResult | null;
  findStation(query: string): MetroStation | null;
  searchStations(query: string): MetroStation[];
  getAllStations(): MetroStation[];
}

/**
 * 地铁计算器实现
 */
export class MetroCalculator implements IMetroCalculator {
  private metroService: MetroService;

  constructor() {
    this.metroService = MetroService.getInstance();
  }

  public calculateCommute(fromStation: string, toStation: string): DistanceResult | null {
    return this.metroService.calculateCommute(fromStation, toStation);
  }

  public findStation(query: string): MetroStation | null {
    return this.metroService.findStation(query);
  }

  public searchStations(query: string): MetroStation[] {
    return this.metroService.searchStations(query);
  }

  public getAllStations(): MetroStation[] {
    return this.metroService.getAllStations();
  }
}
