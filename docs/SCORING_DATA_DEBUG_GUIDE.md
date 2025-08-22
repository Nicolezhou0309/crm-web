# 评分数据调试指南

## 问题描述

用户反馈综合评分数据未在表格中正确展示，但数据库中有评分数据。

## 调试步骤

### 1. 检查数据库数据

运行 `check_scoring_data.sql` 脚本检查数据库中的评分数据：

```bash
psql $DATABASE_URL -f check_scoring_data.sql
```

### 2. 检查前端数据流

#### 2.1 API层调试
在 `src/api/liveStreamApi.ts` 中添加了调试日志：

```typescript
// 调试：检查原始数据
console.log('原始数据库数据示例:', (data || []).slice(0, 3).map(schedule => ({
  id: schedule.id,
  average_score: schedule.average_score,
  scoring_status: schedule.scoring_status,
  scored_at: schedule.scored_at
})));
```

#### 2.2 组件层调试
在 `src/pages/LiveStreamManagement.tsx` 中添加了调试日志：

```typescript
// 调试：检查综合评分列的数据
console.log('综合评分列数据:', filteredData.map(schedule => ({
  id: schedule.id,
  average_score: schedule.average_score,
  average_score_type: typeof schedule.average_score,
  has_average_score: !!schedule.average_score,
  render_result: schedule.average_score ? `${schedule.average_score.toFixed(1)}分` : '-'
})));
```

### 3. 数据类型修复

修复了数据类型转换问题：

```typescript
// 修复前
average_score: schedule.average_score || null,

// 修复后
average_score: schedule.average_score !== null && schedule.average_score !== undefined ? Number(schedule.average_score) : null,
```

### 4. 调试页面

创建了 `src/pages/DebugScoringData.tsx` 调试页面，可以详细查看数据流。

## 可能的问题原因

### 1. 数据类型问题
- 数据库返回的 `average_score` 可能是字符串类型
- 前端期望的是数字类型
- 需要正确的类型转换

### 2. 数据映射问题
- API函数中可能没有正确映射评分字段
- 字段名可能不匹配

### 3. 渲染逻辑问题
- 前端渲染逻辑可能有问题
- 条件判断可能不正确

## 验证方法

### 1. 控制台检查
打开浏览器开发者工具，查看控制台输出：

```javascript
// 应该看到类似这样的输出
原始数据库数据示例: [
  { id: 1, average_score: 8.5, scoring_status: "scored", scored_at: "2025-01-02T..." },
  { id: 2, average_score: null, scoring_status: "not_scored", scored_at: null },
  // ...
]

综合评分列数据: [
  { id: "1", average_score: 8.5, average_score_type: "number", has_average_score: true, render_result: "8.5分" },
  { id: "2", average_score: null, average_score_type: "object", has_average_score: false, render_result: "-" },
  // ...
]
```

### 2. 界面检查
- 综合评分列应该显示具体分数（如：8.5分）
- 没有评分的记录显示 "-"

### 3. 筛选功能检查
- 评分范围筛选应该正常工作
- 评分状态筛选应该正常工作

## 常见问题解决

### 问题1：评分显示为 "-"
**可能原因**：
- 数据类型转换问题
- 数据映射问题

**解决方案**：
- 检查数据类型转换
- 确保API正确映射字段

### 问题2：评分显示为 "NaN"
**可能原因**：
- 数据类型不是数字
- 数值计算错误

**解决方案**：
- 确保数据类型转换正确
- 检查数值计算逻辑

### 问题3：评分筛选不工作
**可能原因**：
- 筛选逻辑有问题
- 数据类型不匹配

**解决方案**：
- 检查筛选逻辑
- 确保数据类型一致

## 测试数据

### 创建测试数据
运行 `insert_test_scoring_data.sql` 创建测试数据：

```bash
psql $DATABASE_URL -f insert_test_scoring_data.sql
```

### 测试数据分布
- 已评分：3条记录，评分8.5分
- 评分中：2条记录，无评分
- 已确认：2条记录，评分9.2分
- 低分记录：1条记录，评分6.8分
- 高分记录：1条记录，评分9.8分

## 调试工具

### 1. 调试页面
访问 `/debug-scoring-data` 查看详细的数据流。

### 2. 控制台日志
查看浏览器控制台的调试信息。

### 3. 数据库查询
直接查询数据库验证数据：

```sql
SELECT 
  id,
  average_score,
  scoring_status,
  scored_at
FROM live_stream_schedules 
WHERE average_score IS NOT NULL
ORDER BY average_score DESC
LIMIT 10;
```

## 预期结果

修复后应该看到：

1. **数据正确显示**：
   - 有评分的记录显示具体分数
   - 无评分的记录显示 "-"

2. **筛选功能正常**：
   - 评分范围筛选工作正常
   - 评分状态筛选工作正常

3. **控制台无错误**：
   - 没有数据类型错误
   - 没有渲染错误

## 总结

通过添加调试信息和修复数据类型转换问题，应该能够解决评分数据显示问题。关键是要确保：

1. ✅ 数据库数据正确
2. ✅ API正确获取和映射数据
3. ✅ 前端正确渲染数据
4. ✅ 数据类型转换正确

如果问题仍然存在，请检查控制台输出，根据调试信息进一步排查问题。 