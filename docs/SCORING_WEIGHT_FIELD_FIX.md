# 评分权重字段精度溢出问题修复

## 问题描述

在更新评分维度时出现数据库错误：
```
numeric field overflow
A field with precision 3, scale 2 must round to an absolute value less than 10^1.
```

## 问题原因

1. **数据库字段定义**：`live_stream_scoring_dimensions` 表中的 `weight` 字段定义为 `DECIMAL(3,2)`
   - 总共3位数字，其中2位小数
   - 最大值只能是 `9.99`

2. **前端表单设置**：权重输入框的最大值设置为 `10`
   - 当用户输入 `10` 或更大的值时，会超出数据库字段的精度范围

## 解决方案

### 1. 前端表单修复

修改 `src/pages/LiveStreamManagement.tsx` 中的权重输入框：

```typescript
// 修改前
<InputNumber min={0} max={10} step={0.1} />

// 修改后  
<InputNumber min={0} max={9.99} step={0.01} />
```

### 2. 数据库字段优化（可选）

如果需要支持更大的权重值，可以考虑修改数据库字段定义：

```sql
-- 修改权重字段精度
ALTER TABLE live_stream_scoring_dimensions 
ALTER COLUMN weight TYPE DECIMAL(4,2);
```

这样可以将最大值扩展到 `99.99`。

## 影响范围

- **权重字段**：`DECIMAL(3,2)` - 最大值 `9.99`
- **分数字段**：`DECIMAL(3,1)` - 最大值 `99.9` - 无需修改

## 验证修复

1. 尝试在评分维度管理中设置权重为 `10.0` - 应该被阻止
2. 尝试设置权重为 `9.99` - 应该成功
3. 检查评分计算是否正常工作

## 注意事项

- 权重值通常不需要超过 `9.99`，因为这是相对权重
- 如果确实需要更大的权重值，建议先修改数据库字段定义
- 前端验证应该与数据库约束保持一致 