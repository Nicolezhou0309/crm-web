import { supabase } from '../../../supaClient';

/**
 * 枚举数据服务
 * 统一管理各种枚举值的获取和缓存
 */
export class EnumDataService {
  private cache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 一年缓存

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
      const formattedData = data?.map((item: any) => ({
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
   * 获取地铁站枚举（原始数据库格式）
   */
  async getMetroStations() {
    const cacheKey = 'metro_stations_raw';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      console.log('📦 [EnumDataService] 从缓存获取地铁站原始数据');
      return { data: cached.data, error: null };
    }

    try {
      console.log('🔄 [EnumDataService] 从数据库获取地铁站原始数据');
      // 使用数据库函数 get_metrostations，确保站点按照地理顺序排列
      const { data, error } = await supabase.rpc('get_metrostations');

      if (error) {
        throw error;
      }

      // 更新缓存
      this.cache.set(cacheKey, { data, timestamp: now });
      console.log(`✅ [EnumDataService] 成功获取 ${data?.length || 0} 个地铁站原始数据`);

      return { data, error: null };
    } catch (error) {
      console.error('[EnumDataService] 获取地铁站失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 获取地铁站枚举（MetroStation格式）
   */
  async getMetroStationsFormatted() {
    const cacheKey = 'metro_stations_formatted';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      console.log('📦 [EnumDataService] 从缓存获取地铁站格式化数据');
      return { data: cached.data, error: null };
    }

    try {
      // 先获取原始数据
      const { data: rawData, error: rawError } = await this.getMetroStations();
      
      if (rawError || !rawData) {
        return { data: [], error: rawError };
      }

      // 转换为MetroStation格式
      const formattedData = this.convertToMetroStations(rawData);
      
      // 更新缓存
      this.cache.set(cacheKey, { data: formattedData, timestamp: now });
      console.log(`✅ [EnumDataService] 成功转换 ${formattedData.length} 个地铁站格式化数据`);

      return { data: formattedData, error: null };
    } catch (error) {
      console.error('[EnumDataService] 转换地铁站数据失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 获取地铁站级联选择器选项
   */
  async getMetroStationCascaderOptions() {
    const cacheKey = 'metro_stations_cascader';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      console.log('📦 [EnumDataService] 从缓存获取地铁站级联选项');
      return { data: cached.data, error: null };
    }

    try {
      // 先获取原始数据
      const { data: rawData, error: rawError } = await this.getMetroStations();
      
      if (rawError || !rawData) {
        return { data: [], error: rawError };
      }

      // 按线路分组，构建Cascader选项结构
      const lineGroups = rawData.reduce((acc: any, station: any) => {
        const line = station.line || '其他';
        if (!acc[line]) {
          acc[line] = [];
        }
        acc[line].push(station);
        return acc;
      }, {});

      // 构建Cascader选项结构，按线路数字顺序排列
      const options = Object.entries(lineGroups)
        .sort(([lineA], [lineB]) => {
          // 提取数字进行排序
          const getLineNumber = (line: string) => {
            const match = line.match(/^(\d+)号线$/);
            return match ? parseInt(match[1]) : 999999;
          };
          return getLineNumber(lineA) - getLineNumber(lineB);
        })
        .map(([line, stations]: [string, any]) => ({
          value: line,
          label: line,
          children: stations.map((station: any) => ({
            value: station.name,
            label: station.name
          }))
        }));

      // 更新缓存
      this.cache.set(cacheKey, { data: options, timestamp: now });
      console.log(`✅ [EnumDataService] 成功构建 ${options.length} 个地铁站级联选项`);

      return { data: options, error: null };
    } catch (error) {
      console.error('[EnumDataService] 构建地铁站级联选项失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 转换数据库数据格式为MetroStation格式
   */
  private convertToMetroStations(dbData: Array<{ line: string; name: string }>): any[] {
    const stations: any[] = [];
    const stationMap = new Map<string, any>();

    dbData.forEach((item, index) => {
      const stationId = `${item.line}-${item.name}`;
      
      if (stationMap.has(item.name)) {
        // 如果站点已存在，更新线路信息
        const existingStation = stationMap.get(item.name)!;
        existingStation.lines = [...new Set([...existingStation.lines, item.line])];
        existingStation.description = `${existingStation.title} (${existingStation.lines.join('、')}号线)`;
      } else {
        // 创建新站点
        const station = {
          id: stationId,
          title: item.name,
          description: `${item.name} (${item.line}号线)`,
          x: 0.5, // 默认坐标，实际使用时需要从数据库获取
          y: 0.5,
          pin: "hidden",
          fill: null,
          zoom: 12,
          distance: null,
          lines: [item.line]
        };
        
        stationMap.set(item.name, station);
        stations.push(station);
      }
    });

    return stations;
  }

  /**
   * 刷新指定枚举的缓存
   */
  refreshEnumCache(tableName: string, valueField: string, labelField: string) {
    const cacheKey = `${tableName}_${valueField}_${labelField}`;
    this.cache.delete(cacheKey);
    console.log(`🔄 [EnumDataService] 已刷新缓存: ${cacheKey}`);
  }

  /**
   * 刷新地铁站相关缓存
   */
  refreshMetroStationsCache() {
    this.cache.delete('metro_stations_raw');
    this.cache.delete('metro_stations_formatted');
    this.cache.delete('metro_stations_cascader');
    console.log('🔄 [EnumDataService] 已刷新所有地铁站相关缓存');
  }

  /**
   * 刷新所有缓存
   */
  refreshAllCache() {
    this.cache.clear();
    console.log('🔄 [EnumDataService] 已刷新所有缓存');
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.CACHE_DURATION) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 [EnumDataService] 已清理 ${cleanedCount} 个过期缓存`);
    }
    
    return cleanedCount;
  }

  /**
   * 预加载地铁站数据
   */
  async preloadMetroStations() {
    try {
      console.log('🚀 [EnumDataService] 开始预加载地铁站数据...');
      
      // 并行加载所有地铁站相关数据
      const [rawResult, formattedResult, cascaderResult] = await Promise.allSettled([
        this.getMetroStations(),
        this.getMetroStationsFormatted(),
        this.getMetroStationCascaderOptions()
      ]);

      const results = {
        raw: rawResult.status === 'fulfilled' ? rawResult.value : null,
        formatted: formattedResult.status === 'fulfilled' ? formattedResult.value : null,
        cascader: cascaderResult.status === 'fulfilled' ? cascaderResult.value : null
      };

      console.log('✅ [EnumDataService] 地铁站数据预加载完成', {
        raw: results.raw?.data?.length || 0,
        formatted: results.formatted?.data?.length || 0,
        cascader: results.cascader?.data?.length || 0
      });

      return results;
    } catch (error) {
      console.error('❌ [EnumDataService] 预加载地铁站数据失败:', error);
      throw error;
    }
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