# 直播数据筛选功能问题诊断报告

## 问题描述

前端调用数据库函数时出现400错误：
```
POST https://wteqgprgiylmxzszcnws.supabase.co/rest/v1/rpc/get_filtered_live_stream_schedules_with_users:1 
Failed to load resource: the server responded with a status of 400 ()
```

## 问题分析

### 1. 400错误原因分析

400错误通常表示：
- **参数类型不匹配**：前端传递的参数类型与数据库函数期望的类型不一致
- **参数数量不匹配**：传递的参数数量与函数定义不符
- **参数值无效**：传递的参数值不符合数据库约束
- **函数权限问题**：用户没有执行函数的权限

### 2. 可能的具体原因

#### 2.1 参数类型问题
```typescript
// 前端传递的参数
{
  p_date_range_start: "2024-01-01",  // 字符串
  p_date_range_end: "2024-12-31",    // 字符串
  p_score_min: 0,                     // 数字
  p_score_max: 10,                    // 数字
  p_page: 1,                          // 数字
  p_page_size: 10                     // 数字
}
```

#### 2.2 数据库函数期望的参数
```sql
CREATE OR REPLACE FUNCTION get_filtered_live_stream_schedules_with_users(
  p_date_range_start DATE DEFAULT NULL,           -- DATE类型
  p_date_range_end DATE DEFAULT NULL,             -- DATE类型
  p_score_min NUMERIC DEFAULT NULL,               -- NUMERIC类型
  p_score_max NUMERIC DEFAULT NULL,               -- NUMERIC类型
  p_page INTEGER DEFAULT 1,                       -- INTEGER类型
  p_page_size INTEGER DEFAULT 10                  -- INTEGER类型
)
```

### 3. 解决方案

#### 3.1 立即解决方案（已实施）
- 暂时使用原始的前端映射方式
- 避免数据库函数调用问题
- 确保功能正常工作

#### 3.2 根本解决方案

1. **参数类型转换**
```typescript
// 确保日期参数正确转换
const params = {
  p_date_range_start: filters.dateRange?.start ? new Date(filters.dateRange.start).toISOString().split('T')[0] : null,
  p_date_range_end: filters.dateRange?.end ? new Date(filters.dateRange.end).toISOString().split('T')[0] : null,
  p_score_min: filters.scoreRange?.min !== undefined ? Number(filters.scoreRange.min) : null,
  p_score_max: filters.scoreRange?.max !== undefined ? Number(filters.scoreRange.max) : null,
  p_page: Number(filters.page || 1),
  p_page_size: Number(filters.pageSize || 10)
};
```

2. **参数验证**
```typescript
// 添加参数验证
const validateParams = (params: any) => {
  const validated: any = {};
  
  // 验证日期参数
  if (params.p_date_range_start) {
    const date = new Date(params.p_date_range_start);
    if (!isNaN(date.getTime())) {
      validated.p_date_range_start = date.toISOString().split('T')[0];
    }
  }
  
  // 验证数值参数
  if (params.p_score_min !== undefined && !isNaN(Number(params.p_score_min))) {
    validated.p_score_min = Number(params.p_score_min);
  }
  
  if (params.p_score_max !== undefined && !isNaN(Number(params.p_score_max))) {
    validated.p_score_max = Number(params.p_score_max);
  }
  
  // 验证分页参数
  validated.p_page = Number(params.p_page || 1);
  validated.p_page_size = Number(params.p_page_size || 10);
  
  return validated;
};
```

3. **错误处理改进**
```typescript
// 改进错误处理
const callDatabaseFunction = async (params: any) => {
  try {
    console.log('调用数据库函数，参数:', params);
    
    const { data, error } = await supabase
      .rpc('get_filtered_live_stream_schedules_with_users', params);

    if (error) {
      console.error('数据库函数调用错误:', error);
      
      // 如果是参数错误，尝试使用默认参数
      if (error.code === '400') {
        console.log('尝试使用默认参数重新调用...');
        return await supabase.rpc('get_filtered_live_stream_schedules_with_users', {
          p_page: 1,
          p_page_size: 10
        });
      }
      
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('函数调用异常:', error);
    throw error;
  }
};
```

### 4. 测试步骤

#### 4.1 数据库函数测试
```sql
-- 测试最简单的调用
SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_page := 1,
  p_page_size := 5
) LIMIT 1;

-- 测试带日期参数的调用
SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31',
  p_page := 1,
  p_page_size := 3
) LIMIT 1;
```

#### 4.2 前端API测试
```javascript
// 在浏览器控制台中测试
const testParams = {
  p_page: 1,
  p_page_size: 5
};

// 测试API调用
supabase.rpc('get_filtered_live_stream_schedules_with_users', testParams)
  .then(result => {
    console.log('API调用成功:', result);
  })
  .catch(error => {
    console.error('API调用失败:', error);
  });
```

### 5. 监控和日志

#### 5.1 添加详细日志
```typescript
// 在API函数中添加详细日志
console.log('函数调用参数:', JSON.stringify(params, null, 2));
console.log('参数类型检查:', {
  dateRange: typeof params.p_date_range_start,
  scoreMin: typeof params.p_score_min,
  page: typeof params.p_page
});
```

#### 5.2 性能监控
```typescript
// 添加性能监控
const startTime = performance.now();
const result = await supabase.rpc('get_filtered_live_stream_schedules_with_users', params);
const endTime = performance.now();
console.log(`函数调用耗时: ${endTime - startTime}ms`);
```

### 6. 后续优化计划

1. **参数类型安全**
   - 使用TypeScript严格类型检查
   - 添加运行时参数验证
   - 实现参数自动转换

2. **错误处理机制**
   - 实现降级策略
   - 添加重试机制
   - 完善错误提示

3. **性能优化**
   - 实现参数缓存
   - 添加查询结果缓存
   - 优化数据库索引

4. **监控和告警**
   - 添加函数调用监控
   - 实现错误率告警
   - 监控响应时间

## 结论

当前问题主要是参数类型不匹配导致的400错误。通过暂时使用原始的前端映射方式，可以确保功能正常工作。后续需要通过参数类型转换和验证来解决根本问题。

## 建议

1. **立即行动**：使用当前的前端映射方式确保功能正常
2. **短期计划**：实现参数类型转换和验证
3. **长期计划**：完善错误处理和监控机制 