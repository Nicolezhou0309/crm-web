/**
 * 缓存管理器 - 处理应用版本更新时的缓存刷新
 */

interface CacheVersion {
  version: string;
  timestamp: number;
}

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  version: string;
}

class CacheManager {
  private static instance: CacheManager;
  private readonly CACHE_VERSION_KEY = 'app_cache_version';
  private readonly CURRENT_VERSION = '1.0.0'; // 每次更新时修改这个版本号
  private readonly CACHE_PREFIX = 'crm_cache_';

  private constructor() {
    this.initializeVersion();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 初始化版本信息
   */
  private initializeVersion(): void {
    const storedVersion = this.getStoredVersion();
    
    if (!storedVersion || storedVersion.version !== this.CURRENT_VERSION) {
      console.log(`🔄 [CacheManager] 检测到版本更新: ${storedVersion?.version || '未知'} -> ${this.CURRENT_VERSION}`);
      this.clearAllCaches();
      this.setStoredVersion(this.CURRENT_VERSION);
    }
  }

  /**
   * 获取存储的版本信息
   */
  private getStoredVersion(): CacheVersion | null {
    try {
      const versionStr = localStorage.getItem(this.CACHE_VERSION_KEY);
      return versionStr ? JSON.parse(versionStr) : null;
    } catch {
      return null;
    }
  }

  /**
   * 设置存储的版本信息
   */
  private setStoredVersion(version: string): void {
    try {
      const versionData: CacheVersion = {
        version,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_VERSION_KEY, JSON.stringify(versionData));
    } catch (error) {
      console.error('设置版本信息失败:', error);
    }
  }

  /**
   * 清除所有应用缓存
   */
  public clearAllCaches(): void {
    console.log('🧹 [CacheManager] 清除所有应用缓存...');
    
    // 清除所有以缓存前缀开头的项目
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    // 清除特定的缓存项
    const specificKeys = [
      'user_cache',
      'profile_cache', 
      'user_cache_timestamp',
      'last_activity_timestamp',
      'session_id',
      'frequency_check',
      'metro_stations_cache'
    ];

    specificKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`✅ [CacheManager] 已清除 ${keysToRemove.length + specificKeys.length} 个缓存项`);
  }

  /**
   * 设置缓存项
   */
  public setCache<T>(key: string, data: T, ttl?: number): void {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        version: this.CURRENT_VERSION
      };

      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('设置缓存失败:', error);
    }
  }

  /**
   * 获取缓存项
   */
  public getCache<T>(key: string, ttl?: number): T | null {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cacheStr = localStorage.getItem(cacheKey);
      
      if (!cacheStr) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cacheStr);
      
      // 检查版本是否匹配
      if (cacheItem.version !== this.CURRENT_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // 检查TTL
      if (ttl && (Date.now() - cacheItem.timestamp) > ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('获取缓存失败:', error);
      return null;
    }
  }

  /**
   * 删除特定缓存项
   */
  public removeCache(key: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('删除缓存失败:', error);
    }
  }

  /**
   * 强制刷新所有缓存
   */
  public forceRefreshAll(): void {
    console.log('🔄 [CacheManager] 强制刷新所有缓存...');
    this.clearAllCaches();
    this.setStoredVersion(this.CURRENT_VERSION);
    
    // 触发页面刷新
    window.location.reload();
  }

  /**
   * 检查是否有新版本
   */
  public checkForUpdates(): boolean {
    const storedVersion = this.getStoredVersion();
    return !storedVersion || storedVersion.version !== this.CURRENT_VERSION;
  }

  /**
   * 获取当前版本
   */
  public getCurrentVersion(): string {
    return this.CURRENT_VERSION;
  }

  /**
   * 获取存储的版本
   */
  public getStoredVersionInfo(): CacheVersion | null {
    return this.getStoredVersion();
  }
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance();

// 导出类型
export type { CacheVersion, CacheItem };
