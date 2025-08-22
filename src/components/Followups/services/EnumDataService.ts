import { supabase } from '../../../supaClient';

/**
 * 枚举数据服务
 * 统一管理各种枚举值的获取和缓存
 */
export class EnumDataService {
  private cache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取枚举值（带缓存）
   */
  async getEnumValues(tableName: string, valueField: string, labelField: string) {
    const cacheKey = `${tableName}_${valueField}_${labelField}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    // 检查缓存是否有效
    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, error: null };
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(`${valueField}, ${labelField}`)
        .order(labelField);

      if (error) {
        throw error;
      }

      // 格式化数据
      const formattedData = data?.map(item => ({
        value: item[valueField],
        label: item[labelField]
      })) || [];

      // 更新缓存
      this.cache.set(cacheKey, { data: formattedData, timestamp: now });

      return { data: formattedData, error: null };
    } catch (error) {
      console.error(`[EnumDataService] 获取枚举值失败: ${tableName}`, error);
      return { data: [], error };
    }
  }

  /**
   * 获取社区枚举
   */
  async getCommunityEnum() {
    return this.getEnumValues('communities', 'code', 'name');
  }

  /**
   * 获取跟进阶段枚举
   */
  async getFollowupStageEnum() {
    return this.getEnumValues('followup_stages', 'code', 'name');
  }

  /**
   * 获取用户画像枚举
   */
  async getCustomerProfileEnum() {
    return this.getEnumValues('customer_profiles', 'code', 'name');
  }

  /**
   * 获取渠道枚举
   */
  async getSourceEnum() {
    return this.getEnumValues('sources', 'code', 'name');
  }

  /**
   * 获取用户评级枚举
   */
  async getUserRatingEnum() {
    return this.getEnumValues('user_ratings', 'code', 'name');
  }

  /**
   * 获取主要类别枚举
   */
  async getMajorCategoryEnum() {
    return this.getEnumValues('major_categories', 'code', 'name');
  }

  /**
   * 获取地铁站枚举
   */
  async getMetroStations() {
    const cacheKey = 'metro_stations';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('metro_stations')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      // 更新缓存
      this.cache.set(cacheKey, { data, timestamp: now });

      return { data, error: null };
    } catch (error) {
      console.error('[EnumDataService] 获取地铁站失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 刷新指定枚举的缓存
   */
  refreshEnumCache(tableName: string, valueField: string, labelField: string) {
    const cacheKey = `${tableName}_${valueField}_${labelField}`;
    this.cache.delete(cacheKey);
  }

  /**
   * 刷新所有缓存
   */
  refreshAllCache() {
    this.cache.clear();
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus() {
    const now = Date.now();
    const status: Record<string, { valid: boolean; age: number }> = {};

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      status[key] = {
        valid: age < this.CACHE_DURATION,
        age: Math.floor(age / 1000) // 转换为秒
      };
    }

    return status;
  }
}