# 评分数据源修复

## 问题描述

用户反馈评分为3.9分，但前台显示为0分或"-"。

## 问题分析

### 🔍 根本原因
评分数据存储在两个不同的地方：
1. **`average_score` 字段**：数据库中显示为 0
2. **`scoring_data` 字段**：JSON格式，包含详细的评分信息，其中 `weighted_average` 为 3.9

### 📊 数据情况
从控制台输出可以看到ID 84记录：
```json
{
  "id": 84,
  "average_score": 0,  // 数据库字段
  "scoring_data": {
    "calculation": {
      "total_score": 21.5,
      "average_score": 4.3,
      "weighted_average": 3.9  // 实际应该显示的评分
    }
  }
}
```

## 解决方案

### 1. 修复数据获取逻辑

**问题**：只从 `average_score` 字段获取评分数据
**解决**：优先从 `scoring_data` 中提取 `weighted_average`，如果没有则使用 `average_score`

```typescript
// 修复前
average_score: schedule.average_score !== null && 
               schedule.average_score !== undefined && 
               schedule.average_score !== '' ? 
               Number(schedule.average_score) : null,

// 修复后
average_score: (() => {
  if (schedule.scoring_data) {
    try {
      const scoringData = JSON.parse(schedule.scoring_data);
      if (scoringData.calculation && scoringData.calculation.weighted_average !== undefined) {
        return Number(scoringData.calculation.weighted_average);
      }
    } catch (e) {
      console.warn('解析scoring_data失败:', e);
    }
  }
  return schedule.average_score !== null && 
         schedule.average_score !== undefined && 
         schedule.average_score !== '' ? 
         Number(schedule.average_score) : null;
})(),
```

### 2. 添加详细调试信息

```typescript
const convertedData = (data || []).map(schedule => {
  // 计算实际的average_score
  let actualAverageScore = null;
  if (schedule.scoring_data) {
    try {
      const scoringData = JSON.parse(schedule.scoring_data);
      if (scoringData.calculation && scoringData.calculation.weighted_average !== undefined) {
        actualAverageScore = Number(scoringData.calculation.weighted_average);
      }
    } catch (e) {
      console.warn('解析scoring_data失败:', e);
    }
  }
  if (actualAverageScore === null) {
    actualAverageScore = schedule.average_score !== null && 
                        schedule.average_score !== undefined && 
                        schedule.average_score !== '' ? 
                        Number(schedule.average_score) : null;
  }
  
  return {
    id: schedule.id,
    original_average_score: schedule.average_score,
    scoring_data_has_weighted_average: schedule.scoring_data ? /* 检查逻辑 */ : false,
    weighted_average_from_scoring_data: schedule.scoring_data ? /* 提取逻辑 */ : null,
    converted_average_score: actualAverageScore,
    converted_type: typeof actualAverageScore
  };
});
```

## 数据优先级

### 1. 主要数据源：`scoring_data.weighted_average`
- 包含加权平均分
- 更准确的评分计算
- 包含详细的评分维度

### 2. 备用数据源：`average_score` 字段
- 简单的平均分
- 可能不是最新的数据
- 作为备用方案

## 预期结果

### 修复前
- ID 84显示：0.0分（来自 `average_score` 字段）

### 修复后
- ID 84显示：3.9分（来自 `scoring_data.weighted_average`）

## 验证方法

### 1. 控制台检查
查看调试信息中的 `converted_average_score` 字段：
```javascript
{
  "id": 84,
  "original_average_score": 0,
  "weighted_average_from_scoring_data": 3.9,
  "converted_average_score": 3.9,
  "converted_type": "number"
}
```

### 2. 界面检查
- ID 84记录应该显示 "3.9分"
- 其他记录正常显示

### 3. 筛选功能检查
- 评分范围筛选应该能正确识别3.9分
- 可以筛选出3.9分的记录

## 数据字段说明

### `scoring_data` 结构
```json
{
  "calculation": {
    "total_score": 21.5,        // 总分
    "average_score": 4.3,       // 简单平均分
    "weighted_average": 3.9     // 加权平均分（主要显示）
  },
  "dimensions": {
    "preparation": { "score": 10 },
    "live_status": { "score": 5.5 },
    "presentation": { "score": 3 },
    "attendance": { "score": 0 },
    "camera_skills": { "score": 3 }
  }
}
```

### 字段优先级
1. **`scoring_data.calculation.weighted_average`** - 主要显示
2. **`average_score`** - 备用显示
3. **null/undefined** - 显示 "-"

## 影响范围

### 修复的文件
1. `src/api/liveStreamApi.ts` - 数据获取逻辑

### 影响的功能
1. ✅ 综合评分列显示
2. ✅ 评分筛选功能
3. ✅ 评分详情查看

## 总结

通过修复数据获取逻辑，现在系统会优先从 `scoring_data` 中提取 `weighted_average` 作为显示的评分，而不是使用可能过时的 `average_score` 字段。

**核心修复**：
- ✅ 优先使用 `scoring_data.weighted_average`
- ✅ 备用使用 `average_score` 字段
- ✅ 添加详细的调试信息
- ✅ 正确处理JSON解析错误

现在ID 84记录应该正确显示3.9分了！🎉 