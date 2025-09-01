/**
 * 地铁配置服务
 * 管理地铁计算相关的配置参数
 */
export class MetroConfigService {
  private static instance: MetroConfigService;

  // 默认配置
  private config = {
    // 时间配置
    timePerStation: 3, // 每站3分钟
    transferTime: 5,   // 每次换乘5分钟
    
    // 距离配置
    distanceMultiplier: 50, // 坐标到实际距离的倍数
    averageStationDistance: 1.3, // 平均站点间距（公里）
    
    // 搜索配置
    maxSearchResults: 20, // 最大搜索结果数量
    searchTimeout: 300,   // 搜索超时时间（毫秒）
    
    // 缓存配置
    enableCache: true,    // 是否启用缓存
    cacheExpiry: 300000,  // 缓存过期时间（5分钟）
    
    // 性能配置
    maxTransferAttempts: 10, // 最大换乘尝试次数
    enableParallelSearch: true, // 是否启用并行搜索
  };

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MetroConfigService {
    if (!MetroConfigService.instance) {
      MetroConfigService.instance = new MetroConfigService();
    }
    return MetroConfigService.instance;
  }

  /**
   * 获取配置值
   */
  public get<T>(key: keyof typeof this.config): T {
    return this.config[key] as T;
  }

  /**
   * 设置配置值
   */
  public set<K extends keyof typeof this.config>(key: K, value: typeof this.config[K]): void {
    this.config[key] = value;
  }

  /**
   * 获取所有配置
   */
  public getAllConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * 重置配置到默认值
   */
  public resetToDefault(): void {
    this.config = {
      timePerStation: 3,
      transferTime: 5,
      distanceMultiplier: 50,
      averageStationDistance: 1.3,
      maxSearchResults: 20,
      searchTimeout: 300,
      enableCache: true,
      cacheExpiry: 300000,
      maxTransferAttempts: 10,
      enableParallelSearch: true,
    };
  }

  /**
   * 获取时间配置
   */
  public getTimeConfig() {
    return {
      timePerStation: this.config.timePerStation,
      transferTime: this.config.transferTime,
    };
  }

  /**
   * 获取距离配置
   */
  public getDistanceConfig() {
    return {
      distanceMultiplier: this.config.distanceMultiplier,
      averageStationDistance: this.config.averageStationDistance,
    };
  }

  /**
   * 获取搜索配置
   */
  public getSearchConfig() {
    return {
      maxSearchResults: this.config.maxSearchResults,
      searchTimeout: this.config.searchTimeout,
    };
  }

  /**
   * 获取缓存配置
   */
  public getCacheConfig() {
    return {
      enableCache: this.config.enableCache,
      cacheExpiry: this.config.cacheExpiry,
    };
  }

  /**
   * 获取性能配置
   */
  public getPerformanceConfig() {
    return {
      maxTransferAttempts: this.config.maxTransferAttempts,
      enableParallelSearch: this.config.enableParallelSearch,
    };
  }
}

/**
 * 地铁配置常量
 */
export const METRO_CONFIG = {
  // 时间常量
  TIME_PER_STATION: 3,
  TRANSFER_TIME: 5,
  
  // 距离常量
  DISTANCE_MULTIPLIER: 50,
  AVERAGE_STATION_DISTANCE: 1.3,
  
  // 搜索常量
  MAX_SEARCH_RESULTS: 20,
  SEARCH_TIMEOUT: 300,
  
  // 缓存常量
  CACHE_EXPIRY: 300000,
  
  // 性能常量
  MAX_TRANSFER_ATTEMPTS: 10,
} as const;

/**
 * 地铁配置类型
 */
export type MetroConfigKey = keyof ReturnType<typeof MetroConfigService.prototype.getAllConfig>;
