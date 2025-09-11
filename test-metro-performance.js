/**
 * 地铁站点数据加载性能测试脚本
 * 测试优化后的EnumDataService统一缓存机制
 */

// 模拟测试环境
const testMetroPerformance = async () => {
  console.log('🚀 开始地铁站点数据加载性能测试...\n');

  // 模拟EnumDataService
  class MockEnumDataService {
    constructor() {
      this.cache = new Map();
      this.CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 一年缓存
    }

    async getMetroStations() {
      const cacheKey = 'metro_stations_raw';
      const now = Date.now();
      const cached = this.cache.get(cacheKey);

      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        console.log('📦 [MockEnumDataService] 从缓存获取地铁站原始数据');
        return { data: cached.data, error: null };
      }

      // 模拟数据库查询延迟
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 模拟408个地铁站点数据
      const mockData = Array.from({ length: 408 }, (_, i) => ({
        line: `${(i % 20) + 1}号线`,
        name: `测试站点${i + 1}`
      }));

      this.cache.set(cacheKey, { data: mockData, timestamp: now });
      console.log(`✅ [MockEnumDataService] 成功获取 ${mockData.length} 个地铁站原始数据`);
      return { data: mockData, error: null };
    }

    async getMetroStationsFormatted() {
      const cacheKey = 'metro_stations_formatted';
      const now = Date.now();
      const cached = this.cache.get(cacheKey);

      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        console.log('📦 [MockEnumDataService] 从缓存获取地铁站格式化数据');
        return { data: cached.data, error: null };
      }

      // 先获取原始数据
      const { data: rawData, error: rawError } = await this.getMetroStations();
      
      if (rawError || !rawData) {
        return { data: [], error: rawError };
      }

      // 转换为MetroStation格式
      const formattedData = rawData.map((item, index) => ({
        id: `${item.line}-${item.name}`,
        title: item.name,
        description: `${item.name} (${item.line})`,
        x: 0.5,
        y: 0.5,
        pin: "hidden",
        fill: null,
        zoom: 12,
        distance: null,
        lines: [item.line]
      }));
      
      this.cache.set(cacheKey, { data: formattedData, timestamp: now });
      console.log(`✅ [MockEnumDataService] 成功转换 ${formattedData.length} 个地铁站格式化数据`);
      return { data: formattedData, error: null };
    }

    async getMetroStationCascaderOptions() {
      const cacheKey = 'metro_stations_cascader';
      const now = Date.now();
      const cached = this.cache.get(cacheKey);

      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        console.log('📦 [MockEnumDataService] 从缓存获取地铁站级联选项');
        return { data: cached.data, error: null };
      }

      // 先获取原始数据
      const { data: rawData, error: rawError } = await this.getMetroStations();
      
      if (rawError || !rawData) {
        return { data: [], error: rawError };
      }

      // 按线路分组，构建Cascader选项结构
      const lineGroups = rawData.reduce((acc, station) => {
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
          const getLineNumber = (line) => {
            const match = line.match(/^(\d+)号线$/);
            return match ? parseInt(match[1]) : 999999;
          };
          return getLineNumber(lineA) - getLineNumber(lineB);
        })
        .map(([line, stations]) => ({
          value: line,
          label: line,
          children: stations.map(station => ({
            value: station.name,
            label: station.name
          }))
        }));

      this.cache.set(cacheKey, { data: options, timestamp: now });
      console.log(`✅ [MockEnumDataService] 成功构建 ${options.length} 个地铁站级联选项`);
      return { data: options, error: null };
    }

    refreshMetroStationsCache() {
      this.cache.delete('metro_stations_raw');
      this.cache.delete('metro_stations_formatted');
      this.cache.delete('metro_stations_cascader');
      console.log('🔄 [MockEnumDataService] 已刷新所有地铁站相关缓存');
    }

    getCacheStatus() {
      const now = Date.now();
      const status = {};

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

  const enumDataService = new MockEnumDataService();

  // 测试1: 首次加载性能
  console.log('📊 测试1: 首次加载性能');
  const start1 = performance.now();
  
  const [rawResult, formattedResult, cascaderResult] = await Promise.all([
    enumDataService.getMetroStations(),
    enumDataService.getMetroStationsFormatted(),
    enumDataService.getMetroStationCascaderOptions()
  ]);
  
  const end1 = performance.now();
  const firstLoadTime = end1 - start1;
  
  console.log(`⏱️  首次加载耗时: ${firstLoadTime.toFixed(2)}ms`);
  console.log(`📈 数据量: 原始=${rawResult.data.length}, 格式化=${formattedResult.data.length}, 级联=${cascaderResult.data.length}\n`);

  // 测试2: 缓存命中性能
  console.log('📊 测试2: 缓存命中性能');
  const start2 = performance.now();
  
  const [cachedRaw, cachedFormatted, cachedCascader] = await Promise.all([
    enumDataService.getMetroStations(),
    enumDataService.getMetroStationsFormatted(),
    enumDataService.getMetroStationCascaderOptions()
  ]);
  
  const end2 = performance.now();
  const cacheHitTime = end2 - start2;
  
  console.log(`⏱️  缓存命中耗时: ${cacheHitTime.toFixed(2)}ms`);
  console.log(`🚀 性能提升: ${(firstLoadTime / cacheHitTime).toFixed(2)}x\n`);

  // 测试3: 并发加载性能
  console.log('📊 测试3: 并发加载性能');
  const start3 = performance.now();
  
  const concurrentPromises = Array.from({ length: 10 }, () => 
    Promise.all([
      enumDataService.getMetroStations(),
      enumDataService.getMetroStationsFormatted(),
      enumDataService.getMetroStationCascaderOptions()
    ])
  );
  
  await Promise.all(concurrentPromises);
  
  const end3 = performance.now();
  const concurrentTime = end3 - start3;
  
  console.log(`⏱️  10次并发加载耗时: ${concurrentTime.toFixed(2)}ms`);
  console.log(`📊 平均每次: ${(concurrentTime / 10).toFixed(2)}ms\n`);

  // 测试4: 缓存状态检查
  console.log('📊 测试4: 缓存状态检查');
  const cacheStatus = enumDataService.getCacheStatus();
  console.log('📦 缓存状态:', cacheStatus);
  console.log(`✅ 有效缓存数量: ${Object.values(cacheStatus).filter(s => s.valid).length}\n`);

  // 测试5: 缓存刷新性能
  console.log('📊 测试5: 缓存刷新性能');
  const start4 = performance.now();
  
  enumDataService.refreshMetroStationsCache();
  
  // 重新加载数据
  await Promise.all([
    enumDataService.getMetroStations(),
    enumDataService.getMetroStationsFormatted(),
    enumDataService.getMetroStationCascaderOptions()
  ]);
  
  const end4 = performance.now();
  const refreshTime = end4 - start4;
  
  console.log(`⏱️  缓存刷新后重新加载耗时: ${refreshTime.toFixed(2)}ms\n`);

  // 性能总结
  console.log('📋 性能测试总结:');
  console.log(`   • 首次加载: ${firstLoadTime.toFixed(2)}ms`);
  console.log(`   • 缓存命中: ${cacheHitTime.toFixed(2)}ms`);
  console.log(`   • 性能提升: ${(firstLoadTime / cacheHitTime).toFixed(2)}x`);
  console.log(`   • 并发加载: ${concurrentTime.toFixed(2)}ms (10次)`);
  console.log(`   • 刷新重载: ${refreshTime.toFixed(2)}ms`);
  console.log(`   • 缓存效率: ${((firstLoadTime - cacheHitTime) / firstLoadTime * 100).toFixed(1)}%`);

  console.log('\n✅ 地铁站点数据加载性能测试完成！');
};

// 运行测试
if (typeof window === 'undefined') {
  // Node.js环境
  testMetroPerformance().catch(console.error);
} else {
  // 浏览器环境
  window.testMetroPerformance = testMetroPerformance;
  console.log('💡 在浏览器控制台中运行: testMetroPerformance()');
}
