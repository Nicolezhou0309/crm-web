import { supabase } from '../supaClient';
import type { MetroStation } from '../utils/metroDistanceCalculator';
import { cacheManager } from '../utils/cacheManager';

/**
 * 地铁数据服务
 * 负责从数据库获取地铁站点数据并缓存到本地
 */
export class MetroDataService {
  private static instance: MetroDataService;
  private cachedStations: MetroStation[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存
  private readonly CACHE_KEY = 'metro_stations_cache';
  private readonly CACHE_TIMESTAMP_KEY = 'metro_stations_cache_timestamp';

  private constructor() {
    this.loadFromLocalStorage();
  }

  public static getInstance(): MetroDataService {
    if (!MetroDataService.instance) {
      MetroDataService.instance = new MetroDataService();
    }
    return MetroDataService.instance;
  }

  /**
   * 获取所有地铁站点数据
   */
  public async getAllStations(): Promise<MetroStation[]> {
    // 检查缓存是否有效
    if (this.isCacheValid()) {
      console.log('📦 [MetroDataService] 使用本地缓存的地铁站点数据');
      return this.cachedStations;
    }

    // 缓存无效，从数据库获取
    console.log('🔄 [MetroDataService] 从数据库获取地铁站点数据');
    return await this.fetchFromDatabase();
  }

  /**
   * 强制刷新数据
   */
  public async refreshStations(): Promise<MetroStation[]> {
    console.log('🔄 [MetroDataService] 强制刷新地铁站点数据');
    this.clearCache();
    return await this.fetchFromDatabase();
  }

  /**
   * 使用缓存管理器获取数据
   */
  public async getStationsWithCacheManager(): Promise<MetroStation[]> {
    // 先尝试从缓存管理器获取
    const cachedData = cacheManager.getCache<MetroStation[]>(this.CACHE_KEY, this.CACHE_DURATION);
    
    if (cachedData) {
      console.log('📦 [MetroDataService] 从缓存管理器获取地铁站点数据');
      return cachedData;
    }

    // 缓存未命中，从数据库获取
    console.log('🔄 [MetroDataService] 从数据库获取地铁站点数据');
    const data = await this.fetchFromDatabase();
    
    // 存储到缓存管理器
    cacheManager.setCache(this.CACHE_KEY, data);
    
    return data;
  }

  /**
   * 从数据库获取地铁站点数据
   */
  private async fetchFromDatabase(): Promise<MetroStation[]> {
    try {
      const { data, error } = await supabase.rpc('get_metrostations');

      if (error) {
        console.error('❌ [MetroDataService] 获取地铁站点数据失败:', error);
        // 如果数据库获取失败，尝试使用本地缓存
        if (this.cachedStations.length > 0) {
          console.log('⚠️ [MetroDataService] 数据库获取失败，使用本地缓存数据');
          return this.cachedStations;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ [MetroDataService] 数据库返回空数据');
        return this.cachedStations;
      }

      // 转换数据格式
      const stations = this.convertToMetroStations(data);
      
      // 更新缓存
      this.updateCache(stations);
      
      console.log(`✅ [MetroDataService] 成功获取 ${stations.length} 个地铁站点数据`);
      return stations;

    } catch (error) {
      console.error('❌ [MetroDataService] 获取地铁站点数据异常:', error);
      
      // 如果数据库获取失败，尝试使用本地缓存
      if (this.cachedStations.length > 0) {
        console.log('⚠️ [MetroDataService] 数据库获取异常，使用本地缓存数据');
        return this.cachedStations;
      }
      
      // 如果连本地缓存都没有，返回空数组
      return [];
    }
  }

  /**
   * 转换数据库数据格式为MetroStation格式
   */
  private convertToMetroStations(dbData: Array<{ line: string; name: string }>): MetroStation[] {
    const stations: MetroStation[] = [];
    const stationMap = new Map<string, MetroStation>();

    dbData.forEach((item, index) => {
      const stationId = `${item.line}-${item.name}`;
      
      if (stationMap.has(item.name)) {
        // 如果站点已存在，更新线路信息
        const existingStation = stationMap.get(item.name)!;
        existingStation.description = `${existingStation.description}, ${item.line}`;
      } else {
        // 创建新站点
        const station: MetroStation = {
          id: stationId,
          title: item.name,
          description: item.line,
          x: 0.5, // 默认坐标，实际项目中可以从数据库获取
          y: 0.5,
          pin: 'hidden',
          fill: null,
          zoom: 1,
          distance: null
        };
        
        stationMap.set(item.name, station);
        stations.push(station);
      }
    });

    return stations;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(): boolean {
    if (this.cachedStations.length === 0) {
      return false;
    }

    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * 更新缓存
   */
  private updateCache(stations: MetroStation[]): void {
    this.cachedStations = stations;
    this.cacheTimestamp = Date.now();
    this.saveToLocalStorage();
  }

  /**
   * 清除缓存
   */
  private clearCache(): void {
    this.cachedStations = [];
    this.cacheTimestamp = 0;
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
  }

  /**
   * 从本地存储加载缓存
   */
  private loadFromLocalStorage(): void {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(this.CACHE_TIMESTAMP_KEY);

      if (cachedData && cachedTimestamp) {
        this.cachedStations = JSON.parse(cachedData);
        this.cacheTimestamp = parseInt(cachedTimestamp);
        
        console.log(`📦 [MetroDataService] 从本地存储加载了 ${this.cachedStations.length} 个地铁站点`);
      }
    } catch (error) {
      console.error('❌ [MetroDataService] 从本地存储加载缓存失败:', error);
      this.clearCache();
    }
  }

  /**
   * 保存到本地存储
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cachedStations));
      localStorage.setItem(this.CACHE_TIMESTAMP_KEY, this.cacheTimestamp.toString());
      console.log('💾 [MetroDataService] 地铁站点数据已保存到本地存储');
    } catch (error) {
      console.error('❌ [MetroDataService] 保存到本地存储失败:', error);
    }
  }

  /**
   * 获取缓存状态信息
   */
  public getCacheInfo(): {
    hasCache: boolean;
    stationCount: number;
    cacheAge: number;
    isValid: boolean;
  } {
    const now = Date.now();
    return {
      hasCache: this.cachedStations.length > 0,
      stationCount: this.cachedStations.length,
      cacheAge: this.cacheTimestamp > 0 ? now - this.cacheTimestamp : 0,
      isValid: this.isCacheValid()
    };
  }

  /**
   * 搜索站点
   */
  public searchStations(query: string): MetroStation[] {
    if (!query.trim()) {
      return this.cachedStations;
    }

    const lowerQuery = query.toLowerCase();
    return this.cachedStations.filter(station =>
      station.title.toLowerCase().includes(lowerQuery) ||
      station.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 根据名称查找站点
   */
  public findStation(query: string): MetroStation | null {
    const lowerQuery = query.toLowerCase();
    
    // 精确匹配
    let station = this.cachedStations.find(s =>
      s.title.toLowerCase() === lowerQuery
    );

    if (station) return station;

    // 模糊匹配
    station = this.cachedStations.find(s =>
      s.title.toLowerCase().includes(lowerQuery)
    );

    return station || null;
  }
}

export default MetroDataService;
