# 工作地点多级选择功能指南

## 功能概述

工作地点字段已从简单的文本输入框改为多级选择（Cascader），数据来源于 `metrostations` 表。

## 数据库结构

### metrostations 表
```sql
create table public.metrostations (
  id bigint generated by default as identity not null,
  line text null,
  name text null,
  constraint metrostations_pkey primary key (id)
) TABLESPACE pg_default;
```

### 数据获取函数
```sql
CREATE OR REPLACE FUNCTION public.get_metrostations()
RETURNS TABLE(
  line text,
  name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.line,
    ms.name
  FROM public.metrostations ms
  ORDER BY ms.line, ms.name;
END;
$$;
```

## 前端实现

### 1. 数据获取
- 使用 `fetchMetroStations()` 函数从后端获取地铁站数据
- 数据按线路分组，构建Cascader选项结构

### 2. 选项结构
```javascript
const options = [
  {
    value: '1号线',
    label: '1号线',
    children: [
      { value: '苹果园', label: '苹果园' },
      { value: '古城', label: '古城' },
      // ...
    ]
  },
  {
    value: '2号线',
    label: '2号线',
    children: [
      { value: '西直门', label: '西直门' },
      { value: '积水潭', label: '积水潭' },
      // ...
    ]
  }
]
```

### 3. 组件使用
- 表格中的工作地点字段使用 `Cascader` 组件
- 抽屉表单中的工作地点字段也使用 `Cascader` 组件
- 支持搜索、清除、禁用等功能

## 部署步骤

### 1. 部署数据库函数
```bash
# 执行SQL脚本
psql -d your_database -f deploy_metrostations_function.sql
```

### 2. 插入地铁站数据
```sql
-- 示例数据
INSERT INTO metrostations (line, name) VALUES
('1号线', '苹果园'),
('1号线', '古城'),
('1号线', '八角游乐园'),
('2号线', '西直门'),
('2号线', '积水潭'),
('2号线', '鼓楼大街');
```

### 3. 测试功能
```bash
# 运行测试脚本
node test_metrostations.js
```

## 功能特性

### 1. 多级选择
- 第一级：地铁线路
- 第二级：具体站点

### 2. 搜索功能
- 支持按线路名和站点名搜索
- 实时过滤显示匹配的选项

### 3. 数据验证
- 自动过滤空值和无效数据
- 按线路分组显示

### 4. 用户体验
- 支持清除选择
- 禁用状态处理
- 占位符提示

## 注意事项

1. **数据完整性**：确保 `metrostations` 表中有数据
2. **性能优化**：数据加载有缓存机制，避免重复请求
3. **错误处理**：网络错误或数据异常时有相应的错误提示
4. **兼容性**：保持与现有筛选和分组功能的兼容

## 故障排除

### 1. 数据不显示
- 检查 `metrostations` 表是否有数据
- 确认 `get_metrostations` 函数是否正常

### 2. 选择不生效
- 检查 `findCascaderPath` 函数是否正确
- 确认 `handleAnyFieldSave` 函数是否正常

### 3. 搜索不工作
- 检查 `showSearch` 属性是否设置
- 确认选项结构是否正确

## 扩展功能

### 1. 添加更多地铁线路
```sql
INSERT INTO metrostations (line, name) VALUES
('3号线', '东直门'),
('3号线', '雍和宫'),
('4号线', '安河桥北'),
('4号线', '北宫门');
```

### 2. 自定义线路分组
可以根据需要修改分组逻辑，比如按区域分组：
```javascript
// 按区域分组示例
const areaGroups = {
  '城北': ['1号线', '2号线'],
  '城东': ['3号线', '4号线'],
  '城南': ['5号线', '6号线']
}
``` 