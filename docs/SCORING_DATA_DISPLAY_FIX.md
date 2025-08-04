# 综合评分数据显示修复

## 问题描述

用户反馈综合评分数据未在表格中正确展示。

## 问题分析

### 🔍 根本原因
在 `getWeeklySchedule` 函数中，没有从数据库获取评分相关字段，导致前端无法显示评分数据。

### 📊 影响范围
- 综合评分列显示为 "-"
- 评分状态列可能显示不正确
- 评分时间列可能显示不正确

## 解决方案

### 1. 修复数据获取逻辑

**问题位置**：`src/api/liveStreamApi.ts` 中的 `getWeeklySchedule` 函数

**修复内容**：添加评分相关字段的获取和映射

```typescript
// 修复前
return (data || []).map(schedule => ({
  // ... 其他字段
  lockEndTime: schedule.lock_end_time,
  // 缺少评分字段
}));

// 修复后
return (data || []).map(schedule => ({
  // ... 其他字段
  lockEndTime: schedule.lock_end_time,
  // 添加评分相关字段
  scoring_status: schedule.scoring_status || 'not_scored',
  average_score: schedule.average_score || null,
  scored_by: schedule.scored_by || null,
  scored_at: schedule.scored_at || null,
  scoring_data: schedule.scoring_data || null,
}));
```

### 2. 添加调试信息

在 `LiveStreamManagement.tsx` 中添加调试日志：

```typescript
// 调试：检查评分数据
console.log('评分数据调试:', filteredData.map(schedule => ({
  id: schedule.id,
  average_score: schedule.average_score,
  scoring_status: schedule.scoring_status,
  scored_at: schedule.scored_at
})));
```

### 3. 创建测试数据

创建 `insert_test_scoring_data.sql` 脚本，为现有数据添加评分信息：

```sql
-- 更新一些记录为已评分状态
UPDATE live_stream_schedules 
SET 
  scoring_status = 'scored',
  average_score = 8.5,
  scored_by = 1,
  scored_at = NOW() - INTERVAL '2 days'
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 3
);
```

## 实施步骤

### 1. 应用代码修复
- ✅ 修复 `getWeeklySchedule` 函数
- ✅ 添加调试日志
- ✅ 创建测试数据脚本

### 2. 测试验证
- [ ] 运行测试数据脚本
- [ ] 检查控制台调试信息
- [ ] 验证评分数据显示

### 3. 功能验证
- [ ] 综合评分列正确显示
- [ ] 评分状态列正确显示
- [ ] 评分时间列正确显示
- [ ] 评分筛选功能正常

## 数据库字段说明

### 评分相关字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `scoring_status` | TEXT | 评分状态：not_scored, scoring_in_progress, scored, approved |
| `average_score` | NUMERIC(3,1) | 平均评分：0.0-10.0 |
| `scored_by` | BIGINT | 评分人员ID |
| `scored_at` | TIMESTAMPTZ | 评分时间 |
| `scoring_data` | JSONB | 详细评分数据 |

### 字段映射
| 数据库字段 | 前端字段 | 说明 |
|------------|----------|------|
| `scoring_status` | `scoring_status` | 评分状态 |
| `average_score` | `average_score` | 平均评分 |
| `scored_by` | `scored_by` | 评分人员ID |
| `scored_at` | `scored_at` | 评分时间 |
| `scoring_data` | `scoring_data` | 详细评分数据 |

## 测试数据

### 评分状态分布
- **已评分**：3条记录，评分8.5分
- **评分中**：2条记录，无评分
- **已确认**：2条记录，评分9.2分
- **低分记录**：1条记录，评分6.8分
- **高分记录**：1条记录，评分9.8分

### 评分范围测试
- 6.8分 - 测试低分显示
- 8.5分 - 测试中等分数
- 9.2分 - 测试高分显示
- 9.8分 - 测试最高分显示

## 预期结果

### 修复前
- 综合评分列显示 "-"
- 无法进行评分筛选
- 评分状态可能显示不正确

### 修复后
- 综合评分列正确显示评分（如：8.5分）
- 评分筛选功能正常工作
- 评分状态正确显示
- 评分时间正确显示

## 验证方法

### 1. 控制台检查
打开浏览器开发者工具，查看控制台输出：
```javascript
评分数据调试: [
  { id: "1", average_score: 8.5, scoring_status: "scored", scored_at: "2025-01-02T..." },
  { id: "2", average_score: null, scoring_status: "scoring_in_progress", scored_at: null },
  // ...
]
```

### 2. 界面检查
- 综合评分列显示具体分数
- 评分状态列显示正确状态
- 评分时间列显示正确时间

### 3. 筛选功能检查
- 评分范围筛选正常工作
- 评分状态筛选正常工作
- 评分时间筛选正常工作

## 后续优化

### 1. 性能优化
- 考虑添加评分数据索引
- 优化评分数据查询

### 2. 功能增强
- 添加评分详情查看
- 实现评分历史记录
- 添加评分趋势分析

### 3. 用户体验
- 优化评分显示样式
- 添加评分颜色标识
- 实现评分快速操作

## 总结

通过修复 `getWeeklySchedule` 函数中缺失的评分字段映射，解决了综合评分数据未显示的问题。现在评分数据应该能够正确显示在表格中，并且所有相关的筛选功能都能正常工作。

**关键修复点**：
- ✅ 添加评分字段映射
- ✅ 添加调试信息
- ✅ 创建测试数据
- ✅ 完善文档说明 