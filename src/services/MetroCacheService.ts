import type { DistanceResult } from '../utils/metroDistanceCalculator';
import { MetroConfigService } from './MetroConfigService';

/**
 * 缓存项接口
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

/**
 * 地铁缓存服务
 * 提供计算结果缓存功能，提高性能
 */
export class MetroCacheService {
  private static instance: MetroCacheService;
  private cache: Map<string, CacheItem<any>>;
  private configService: MetroConfigService;

  private constructor() {
    this.cache = new Map();
    this.configService = MetroConfigService.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MetroCacheService {
    if (!MetroCacheService.instance) {
      MetroCacheService.instance = new MetroCacheService();
    }
    return MetroCacheService.instance;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(fromStation: string, toStation: string): string {
    return `${fromStation}_${toStation}`.toLowerCase();
  }

  /**
   * 设置缓存
   */
  public set<T>(key: string, data: T, expiry?: number): void {
    if (!this.configService.get('enableCache')) {
      return;
    }

    const timestamp = Date.now();
    const defaultExpiry = this.configService.get('cacheExpiry') as number;
    const itemExpiry = expiry || defaultExpiry;

    this.cache.set(key, {
      data,
      timestamp,
      expiry: itemExpiry,
    });

    // 清理过期缓存
    this.cleanup();
  }

  /**
   * 获取缓存
   */
  public get<T>(key: string): T | null {
    if (!this.configService.get('enableCache')) {
      return null;
    }

    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 缓存通勤计算结果
   */
  public cacheCommuteResult(fromStation: string, toStation: string, result: DistanceResult): void {
    const cacheKey = this.generateCacheKey(fromStation, toStation);
    this.set(cacheKey, result);
  }

  /**
   * 获取缓存的通勤计算结果
   */
  public getCachedCommuteResult(fromStation: string, toStation: string): DistanceResult | null {
    const cacheKey = this.generateCacheKey(fromStation, toStation);
    return this.get<DistanceResult>(cacheKey);
  }

  /**
   * 检查是否有缓存的通勤计算结果
   */
  public hasCachedCommuteResult(fromStation: string, toStation: string): boolean {
    const cacheKey = this.generateCacheKey(fromStation, toStation);
    const item = this.cache.get(cacheKey);
    
    if (!item) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.expiry) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): {
    totalItems: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
  } {
    const totalItems = this.cache.size;
    const totalSize = this.getCacheSize();
    
    // 这里可以添加命中率统计逻辑
    const hitRate = 0.8; // 示例值
    const missRate = 1 - hitRate;

    return {
      totalItems,
      totalSize,
      hitRate,
      missRate,
    };
  }

  /**
   * 获取缓存大小（字节）
   */
  private getCacheSize(): number {
    let totalSize = 0;
    for (const [key, value] of this.cache.entries()) {
      totalSize += key.length;
      totalSize += JSON.stringify(value).length;
    }
    return totalSize;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 预加载常用路线
   */
  public preloadCommonRoutes(): void {
    const commonRoutes = [
      ['莘庄', '人民广场'],
      ['人民广场', '浦东1号2号航站楼'],
      ['虹桥火车站', '浦东1号2号航站楼'],
      ['徐家汇', '陆家嘴'],
      ['上海南站', '上海火车站'],
    ];

    // 这里可以实现预加载逻辑
    console.log('预加载常用路线:', commonRoutes);
  }

  /**
   * 批量缓存
   */
  public batchSet<T>(items: Array<{ key: string; data: T; expiry?: number }>): void {
    items.forEach(({ key, data, expiry }) => {
      this.set(key, data, expiry);
    });
  }

  /**
   * 获取所有缓存键
   */
  public getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 检查缓存是否启用
   */
  public isEnabled(): boolean {
    return this.configService.get('enableCache');
  }

  /**
   * 启用缓存
   */
  public enable(): void {
    this.configService.set('enableCache', true);
  }

  /**
   * 禁用缓存
   */
  public disable(): void {
    this.configService.set('enableCache', false);
    this.clear();
  }
}

/**
 * 缓存服务工厂
 */
export class MetroCacheServiceFactory {
  /**
   * 创建缓存服务实例
   */
  public static createService(): MetroCacheService {
    return MetroCacheService.getInstance();
  }

  /**
   * 创建测试用的缓存服务实例
   */
  public static createTestService(): MetroCacheService {
    return MetroCacheService.getInstance();
  }
}
