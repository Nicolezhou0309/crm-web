# BI数据分析系统部署指南

## 📋 概述

本指南将帮助您部署BI数据分析系统，包括透视表配置表和相关函数。

## 🚀 快速部署

### 方法一：使用完整迁移脚本（推荐）

1. **打开Supabase SQL编辑器**
   - 登录您的Supabase项目
   - 进入SQL编辑器页面

2. **执行迁移脚本**
   - 复制 `migration_bi_analysis_system.sql` 文件内容
   - 粘贴到SQL编辑器中
   - 点击"运行"按钮

3. **验证部署**
   - 检查是否显示 "BI数据分析系统迁移完成！" 消息
   - 在表列表中查看是否创建了 `bi_pivot_configs` 表

### 方法二：分步执行

如果完整脚本执行失败，可以分步执行：

1. **创建基础表**
```sql
-- 复制 create_bi_table.sql 文件内容并执行
```

2. **创建函数**
```sql
-- 手动执行各个函数创建语句
```

## 📊 功能说明

### 创建的表

- **bi_pivot_configs**: 透视表配置表
  - 存储用户创建的透视表配置
  - 支持公开/私有配置
  - 包含行级安全策略

### 创建的函数

1. **execute_pivot_analysis**: 执行透视表分析
2. **get_bi_statistics**: 获取BI系统统计信息
3. **save_pivot_config**: 保存透视表配置
4. **get_user_pivot_configs**: 获取用户配置
5. **delete_pivot_config**: 删除透视表配置
6. **get_available_data_sources**: 获取可用数据源
7. **get_data_source_fields**: 获取字段信息

## 🔧 使用说明

### 前端集成

部署完成后，前端应用将能够：

1. **保存透视表配置**
   - 用户配置的透视表可以保存到数据库
   - 支持配置名称和描述

2. **加载保存的配置**
   - 显示用户创建的所有配置
   - 支持快速应用配置

3. **管理配置**
   - 编辑配置名称和描述
   - 删除不需要的配置

### 数据源支持

系统支持以下数据源：

- **joined_data**: 关联数据（leads + followups + showings + deals）
- **leads**: 线索数据
- **showings_with_leads**: 带看数据（含线索信息，处理一对多关系）
- **deals_with_leads**: 成交数据（含线索信息，处理一对多关系）

### 一对多关系处理

系统正确处理了以下一对多关系：

1. **一条线索 → 多条带看记录**
   - 使用 `showings_with_leads` 数据源
   - 每条带看记录都包含完整的线索信息
   - 支持按线索维度聚合带看数据

2. **一条线索 → 多条成交记录**
   - 使用 `deals_with_leads` 数据源
   - 每条成交记录都包含完整的线索信息
   - 支持按线索维度聚合成交数据

3. **聚合支持**
   - 所有字段都可以作为聚合字段
   - 支持 `sum`、`count`、`count_distinct`、`avg`、`max`、`min` 聚合方式
   - 字符串字段默认使用 `count_distinct` 聚合
   - 数字字段默认使用 `sum` 聚合
   - 类似Excel透视表的灵活性

## 🛠️ 故障排除

### 常见问题

1. **表已存在错误**
   ```sql
   -- 删除现有表（谨慎操作）
   DROP TABLE IF EXISTS public.bi_pivot_configs CASCADE;
   ```

2. **权限错误**
   - 确保使用正确的数据库连接
   - 检查用户权限设置

3. **函数创建失败**
   - 检查SQL语法
   - 确保没有语法错误

### 验证部署

执行以下查询验证部署是否成功：

```sql
-- 检查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'bi_pivot_configs'
);

-- 检查函数是否存在
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%pivot%';

-- 测试统计函数
SELECT * FROM get_bi_statistics();
```

## 📝 后续步骤

1. **测试功能**
   - 访问数据分析页面
   - 尝试创建和保存透视表配置

2. **自定义配置**
   - 根据需要修改字段映射
   - 调整聚合函数

3. **性能优化**
   - 监控查询性能
   - 根据需要添加索引

## 📞 支持

如果遇到问题，请检查：

1. SQL执行日志
2. 数据库连接状态
3. 用户权限设置

---

**注意**: 部署前请备份重要数据，确保在测试环境中先验证脚本的正确性。 