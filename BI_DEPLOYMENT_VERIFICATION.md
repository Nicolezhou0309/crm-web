# BI数据分析系统部署验证指南

## ✅ 部署状态

**迁移文件已成功部署到远程Supabase数据库！**

- 迁移文件：`20250115000004_bi_analysis_system.sql`
- 部署时间：`2025-01-15`
- 项目ID：`wteqgprgiylmxzszcnws`

## 🔍 验证步骤

### 1. 在Supabase Dashboard中验证

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目：`537093913@qq.com's Project`
3. 进入 **Database** → **Tables**
4. 检查是否存在 `bi_pivot_configs` 表

### 2. 验证表结构

在Supabase Dashboard的SQL编辑器中运行：

```sql
-- 检查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'bi_pivot_configs'
);

-- 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bi_pivot_configs'
ORDER BY ordinal_position;
```

### 3. 验证函数

在SQL编辑器中运行：

```sql
-- 检查函数是否存在
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'execute_pivot_analysis',
  'get_bi_statistics',
  'save_pivot_config',
  'get_user_pivot_configs',
  'delete_pivot_config',
  'get_available_data_sources',
  'get_data_source_fields'
);
```

### 4. 测试基本功能

```sql
-- 测试获取数据源
SELECT * FROM get_available_data_sources();

-- 测试获取字段信息
SELECT * FROM get_data_source_fields('joined_data') LIMIT 10;

-- 测试BI统计
SELECT * FROM get_bi_statistics();
```

## 🎯 预期结果

### 表结构验证
- ✅ `bi_pivot_configs` 表存在
- ✅ 包含以下字段：`id`, `name`, `description`, `config`, `data_source`, `created_by`, `is_public`, `created_at`, `updated_at`
- ✅ 索引已创建
- ✅ RLS策略已启用

### 函数验证
- ✅ `execute_pivot_analysis` - 透视表执行函数
- ✅ `get_bi_statistics` - BI统计函数
- ✅ `save_pivot_config` - 保存配置函数
- ✅ `get_user_pivot_configs` - 获取用户配置函数
- ✅ `delete_pivot_config` - 删除配置函数
- ✅ `get_available_data_sources` - 获取数据源函数
- ✅ `get_data_source_fields` - 获取字段信息函数

### 数据源验证
- ✅ `joined_data` - 关联数据
- ✅ `leads` - 线索数据
- ✅ `showings_with_leads` - 带看数据（含线索信息）
- ✅ `deals_with_leads` - 成交数据（含线索信息）

## 🚀 前端测试

1. 打开您的CRM应用
2. 进入 **数据分析** 页面
3. 检查是否不再显示"BI透视表配置表未创建"的提示
4. 尝试拖拽字段创建透视表
5. 测试保存和加载配置功能

## 🔧 故障排除

### 如果表不存在
```sql
-- 手动创建表
CREATE TABLE IF NOT EXISTS public.bi_pivot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL,
  data_source text NOT NULL,
  created_by text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 如果函数不存在
```sql
-- 重新执行迁移文件
-- 在Supabase Dashboard的SQL编辑器中运行完整的迁移文件内容
```

### 如果权限问题
```sql
-- 检查RLS策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'bi_pivot_configs';
```

## 📞 支持

如果遇到问题，请检查：
1. Supabase项目连接状态
2. 用户权限设置
3. 数据库日志中的错误信息

---

**部署完成！您现在可以使用完整的BI数据分析功能了。** 🎉 