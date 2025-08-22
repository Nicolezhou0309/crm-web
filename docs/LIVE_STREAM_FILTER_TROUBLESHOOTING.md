# 直播数据筛选功能故障排除指南

## 常见错误及解决方案

### 1. 函数不存在错误

**错误信息：**
```
Could not find the function public.get_filtered_live_stream_schedules
```

**解决方案：**
1. 确保数据库函数已正确创建
2. 执行部署脚本：
```bash
chmod +x deploy-live-stream-filter-complete.sh
./deploy-live-stream-filter-complete.sh
```

3. 验证函数是否存在：
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'get_filtered_live_stream_schedules',
  'get_filtered_live_stream_schedules_with_users'
)
AND routine_schema = 'public';
```

### 2. 参数类型错误

**错误信息：**
```
function get_filtered_live_stream_schedules_with_users(unknown, unknown, ...) does not exist
```

**解决方案：**
1. 检查前端传递的参数类型
2. 确保日期格式为 `YYYY-MM-DD`
3. 确保数组参数正确传递

### 3. 权限错误

**错误信息：**
```
permission denied for function get_filtered_live_stream_schedules_with_users
```

**解决方案：**
1. 确保数据库用户有执行函数的权限
2. 检查RLS策略是否正确配置
3. 验证用户身份认证

### 4. 性能问题

**问题：** 查询响应缓慢

**解决方案：**
1. 检查数据库索引是否正确创建
2. 使用优化版本的函数
3. 减少查询的数据量
4. 添加适当的筛选条件

### 5. 数据不显示

**问题：** 筛选后没有数据显示

**解决方案：**
1. 检查筛选条件是否过于严格
2. 验证数据是否存在
3. 检查日期范围是否正确
4. 确认用户权限

## 调试步骤

### 1. 检查数据库函数

```sql
-- 检查函数是否存在
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%live_stream%';

-- 检查函数参数
SELECT 
  parameter_name,
  parameter_mode,
  data_type
FROM information_schema.parameters 
WHERE specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'get_filtered_live_stream_schedules_with_users'
);
```

### 2. 测试函数调用

```sql
-- 基础测试
SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_page := 1,
  p_page_size := 5
) LIMIT 1;

-- 带筛选条件测试
SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31',
  p_statuses := ARRAY['completed'],
  p_page := 1,
  p_page_size := 3
);
```

### 3. 检查数据表

```sql
-- 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'live_stream_schedules'
ORDER BY ordinal_position;

-- 检查数据量
SELECT COUNT(*) FROM live_stream_schedules;

-- 检查用户数据
SELECT COUNT(*) FROM users_profile;
```

### 4. 检查索引

```sql
-- 检查索引
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'live_stream_schedules';

-- 检查索引使用情况
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'live_stream_schedules';
```

## 前端调试

### 1. 检查网络请求

在浏览器开发者工具中：
1. 打开 Network 标签页
2. 查看 API 请求的详细信息
3. 检查请求参数和响应数据
4. 确认请求URL正确

### 2. 检查控制台错误

1. 打开 Console 标签页
2. 查看JavaScript错误信息
3. 检查API调用是否成功
4. 验证数据格式

### 3. 调试API调用

```javascript
// 在浏览器控制台中测试
const testFilters = {
  dateRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  },
  page: 1,
  pageSize: 10
};

// 测试API调用
getFilteredLiveStreamSchedulesOptimized(testFilters)
  .then(result => {
    console.log('API调用成功:', result);
  })
  .catch(error => {
    console.error('API调用失败:', error);
  });
```

## 性能优化建议

### 1. 数据库优化

1. **创建合适的索引**
```sql
-- 复合索引
CREATE INDEX idx_live_stream_schedules_composite 
ON live_stream_schedules (date, status, scoring_status);

-- 部分索引（只索引有效数据）
CREATE INDEX idx_live_stream_schedules_active 
ON live_stream_schedules (date, status) 
WHERE status != 'deleted';
```

2. **优化查询**
```sql
-- 使用EXPLAIN分析查询计划
EXPLAIN ANALYZE 
SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31'
);
```

### 2. 前端优化

1. **防抖处理**
```javascript
import { debounce } from 'lodash';

const debouncedLoadData = debounce(loadData, 300);
```

2. **缓存策略**
```javascript
// 缓存筛选结果
const [cache, setCache] = useState(new Map());

const getCachedData = (filters) => {
  const key = JSON.stringify(filters);
  return cache.get(key);
};
```

3. **分页优化**
```javascript
// 使用虚拟滚动处理大量数据
import { FixedSizeList as List } from 'react-window';
```

## 监控和日志

### 1. 数据库监控

```sql
-- 监控函数调用次数
SELECT 
  routine_name,
  calls,
  total_time,
  mean_time
FROM pg_stat_user_functions 
WHERE routine_name LIKE '%live_stream%';
```

### 2. 前端监控

```javascript
// 添加性能监控
const loadDataWithMonitoring = async (filters) => {
  const startTime = performance.now();
  
  try {
    const result = await getFilteredLiveStreamSchedulesOptimized(filters);
    const endTime = performance.now();
    
    console.log(`API调用耗时: ${endTime - startTime}ms`);
    return result;
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
};
```

## 常见问题FAQ

### Q1: 为什么筛选后没有数据？
A1: 检查筛选条件是否过于严格，确认数据存在且符合筛选条件。

### Q2: 为什么查询很慢？
A2: 检查数据库索引，使用优化版本的函数，减少查询数据量。

### Q3: 为什么用户信息显示不正确？
A3: 确认使用优化版本的API函数，检查用户数据是否存在。

### Q4: 如何添加新的筛选条件？
A4: 修改数据库函数和前端API，添加相应的参数和处理逻辑。

### Q5: 如何优化大量数据的显示？
A5: 使用分页、虚拟滚动、缓存等技术优化性能。

## 联系支持

如果遇到无法解决的问题，请提供以下信息：
1. 错误信息截图
2. 浏览器控制台日志
3. 网络请求详情
4. 数据库函数测试结果
5. 复现步骤 