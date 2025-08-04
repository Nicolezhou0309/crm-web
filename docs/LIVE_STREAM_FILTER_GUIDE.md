# 直播数据筛选功能指南

## 功能概述

直播数据筛选功能提供了强大的表头筛选能力，支持多字段筛选、评分范围筛选、人员筛选、日期范围筛选等功能。

## 功能特性

### 1. 多字段筛选支持
- ✅ 所有字段支持多选筛选
- ✅ 时间段多选筛选
- ✅ 状态多选筛选
- ✅ 评分状态多选筛选
- ✅ 锁定类型多选筛选

### 2. 评分范围筛选
- ✅ 支持评分范围滑块筛选
- ✅ 支持无评分数据筛选
- ✅ 实时评分范围显示

### 3. 人员支持范围包含
- ✅ 参与人员模糊搜索
- ✅ 评分人员筛选
- ✅ 创建人员筛选
- ✅ 编辑人员筛选

### 4. 日期范围筛选
- ✅ 日期范围选择器
- ✅ 评分时间范围筛选
- ✅ 快捷日期范围选择
- ✅ **直播日期时间范围筛选**（新增）

## 使用方法

### 1. 表头筛选
1. 在直播管理页面找到需要筛选的列
2. 点击列标题右侧的筛选图标
3. 在弹出的筛选面板中选择筛选条件
4. 点击"筛选"按钮应用筛选

### 2. 多选筛选
- 对于支持多选的字段（如状态、时间段等），可以同时选择多个值
- 使用 `Ctrl/Cmd + 点击` 进行多选
- 选择完成后点击"筛选"按钮

### 3. 范围筛选
- 对于评分和时间字段，支持范围筛选
- 使用滑块或日期选择器设置范围
- 支持精确的数值范围设置

### 4. 文本搜索
- 对于参与人员字段，支持文本模糊搜索
- 输入关键词进行实时搜索
- 支持姓名和邮箱搜索

### 5. 日期范围筛选（新增）
- **直播日期筛选**：支持精确的日期范围选择
- **快捷日期选择**：提供今天、最近一周、一月、三月、一年等快捷选项
- **自定义日期范围**：可以手动选择任意开始和结束日期
- **评分时间筛选**：支持评分时间的范围筛选

## 日期筛选详细说明

### 直播日期筛选
1. 点击"日期"列标题的筛选图标
2. 在弹出的面板中可以看到两个选项：
   - **日期范围**：使用日期选择器选择具体的开始和结束日期
   - **快捷选择**：选择预设的时间范围

### 快捷日期选项
- **今天**：只显示今天的直播数据
- **最近一周**：显示最近7天的直播数据
- **最近一月**：显示最近30天的直播数据
- **最近三月**：显示最近90天的直播数据
- **最近一年**：显示最近365天的直播数据

### 自定义日期范围
1. 在"日期范围"部分点击日期选择器
2. 选择开始日期和结束日期
3. 点击"筛选"按钮应用筛选

## 技术实现

### 后端筛选函数

```sql
-- 数据库筛选函数
CREATE OR REPLACE FUNCTION get_filtered_live_stream_schedules(
  p_date_range_start DATE DEFAULT NULL,
  p_date_range_end DATE DEFAULT NULL,
  p_time_slots TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_scoring_statuses TEXT[] DEFAULT NULL,
  p_score_min NUMERIC DEFAULT NULL,
  p_score_max NUMERIC DEFAULT NULL,
  p_lock_types TEXT[] DEFAULT NULL,
  p_participants TEXT[] DEFAULT NULL,
  p_scored_by BIGINT[] DEFAULT NULL,
  p_created_by BIGINT[] DEFAULT NULL,
  p_editing_by BIGINT[] DEFAULT NULL,
  p_locations TEXT[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10
)
```

### 前端API接口

```typescript
export interface LiveStreamFilterParams {
  // 日期范围筛选
  dateRange?: {
    start: string;
    end: string;
  };
  
  // 时间段多选筛选
  timeSlots?: string[];
  
  // 状态多选筛选
  statuses?: string[];
  
  // 评分状态多选筛选
  scoringStatuses?: string[];
  
  // 评分范围筛选
  scoreRange?: {
    min: number;
    max: number;
  };
  
  // 锁定类型多选筛选
  lockTypes?: string[];
  
  // 参与人员筛选（支持模糊搜索）
  participants?: string[];
  
  // 评分人员筛选
  scoredBy?: number[];
  
  // 创建人员筛选
  createdBy?: number[];
  
  // 编辑人员筛选
  editingBy?: number[];
  
  // 地点筛选
  locations?: string[];
  
  // 分页参数
  page?: number;
  pageSize?: number;
}
```

## 性能优化

### 1. 数据库索引
- 创建了复合索引优化筛选性能
- 使用GIN索引优化数组字段搜索
- 针对常用筛选字段创建专门索引

### 2. 查询优化
- 使用数据库函数减少网络传输
- 支持分页查询减少内存占用
- 优化JOIN查询减少数据量

### 3. 前端优化
- 使用防抖处理筛选输入
- 支持分页加载减少初始加载时间
- 缓存筛选结果提高响应速度

## 部署说明

### 1. 执行数据库函数
```bash
# 执行SQL文件创建筛选函数
psql $DATABASE_URL -f create_live_stream_filter_function.sql
```

### 2. 运行部署脚本
```bash
# 使用部署脚本
chmod +x deploy-live-stream-filter.sh
./deploy-live-stream-filter.sh
```

## 注意事项

1. **数据权限**：确保用户有相应的数据访问权限
2. **性能考虑**：大量数据时建议使用分页查询
3. **筛选组合**：多个筛选条件组合时注意性能影响
4. **数据一致性**：筛选结果基于实时数据，可能存在延迟
5. **日期格式**：日期筛选使用 YYYY-MM-DD 格式

## 故障排除

### 常见问题

1. **筛选不生效**
   - 检查数据库函数是否正确创建
   - 确认API接口参数正确
   - 查看浏览器控制台错误信息

2. **性能问题**
   - 检查数据库索引是否正确创建
   - 确认筛选条件是否过于复杂
   - 考虑使用分页减少数据量

3. **数据不显示**
   - 检查筛选条件是否过于严格
   - 确认数据权限设置
   - 查看网络请求是否成功

4. **日期筛选问题**
   - 确认日期格式正确（YYYY-MM-DD）
   - 检查日期范围是否合理
   - 验证时区设置是否正确

### 调试方法

1. **查看网络请求**
   - 打开浏览器开发者工具
   - 查看Network标签页的API请求
   - 检查请求参数和响应数据

2. **查看控制台日志**
   - 打开浏览器开发者工具
   - 查看Console标签页的错误信息
   - 检查JavaScript执行错误

3. **数据库查询测试**
   - 直接执行数据库函数测试
   - 检查SQL语法和参数
   - 验证返回结果正确性

## 更新日志

### v1.1.0 (2024-01-15)
- ✅ 新增直播日期时间范围筛选功能
- ✅ 支持自定义日期范围选择
- ✅ 添加快捷日期选择选项
- ✅ 优化日期筛选用户体验

### v1.0.0 (2024-01-15)
- ✅ 实现基础筛选功能
- ✅ 支持多字段筛选
- ✅ 支持评分范围筛选
- ✅ 支持人员筛选
- ✅ 支持日期范围筛选
- ✅ 实现表头筛选界面
- ✅ 优化后端查询性能 