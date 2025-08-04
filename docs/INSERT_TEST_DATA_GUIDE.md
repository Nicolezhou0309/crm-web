# 测试数据插入指南

## 问题描述

由于 RLS (Row Level Security) 策略的限制，无法通过 API 直接插入测试数据。需要在 Supabase 控制台中手动执行 SQL 脚本。

## 解决步骤

### 方法1：使用 Supabase SQL Editor（推荐）

1. **登录 Supabase 控制台**
   - 访问：https://supabase.com/dashboard
   - 选择项目：wteqgprgiylmxzszcnws

2. **打开 SQL Editor**
   - 在左侧菜单中点击 "SQL Editor"
   - 点击 "New query" 创建新查询

3. **运行测试数据插入脚本**
   - 复制 `insert-test-data-sql.sql` 文件的内容
   - 粘贴到 SQL Editor 中
   - 点击 "Run" 执行

4. **验证数据插入**
   ```sql
   -- 检查插入的数据
   SELECT * FROM live_stream_schedules ORDER BY date, time_slot_id;
   ```

### 方法2：使用 Supabase CLI

如果您有 Supabase CLI 访问权限：

```bash
# 连接到数据库
supabase db connect

# 运行 SQL 脚本
psql -f insert-test-data-sql.sql
```

### 方法3：临时禁用 RLS（仅用于测试）

如果需要通过 API 插入数据，可以临时禁用 RLS：

```sql
-- 临时禁用 RLS（仅用于测试）
ALTER TABLE live_stream_schedules DISABLE ROW LEVEL SECURITY;

-- 插入数据后重新启用
ALTER TABLE live_stream_schedules ENABLE ROW LEVEL SECURITY;
```

## 测试数据说明

插入的测试数据包括：

### 2025-01-15（今天）
- **上午 10-12点**：已报名，未评分
- **下午 14-16点**：已完成，已评分（8.5分）

### 2025-01-16（明天）
- **上午 10-12点**：可报名
- **下午 14-16点**：已锁定

### 2025-01-17（后天）
- **上午 10-12点**：评分中
- **下午 14-16点**：已确认（9.2分）

### 2025-01-18（大后天）
- **上午 10-12点**：已取消
- **下午 14-16点**：编辑中

## 验证步骤

### 1. 检查数据库
```sql
-- 查看所有直播安排
SELECT 
  id,
  date,
  time_slot_id,
  status,
  scoring_status,
  average_score
FROM live_stream_schedules 
ORDER BY date, time_slot_id;
```

### 2. 检查前端显示
1. 刷新直播管理页面
2. 检查浏览器控制台是否有错误
3. 查看表格是否显示8条记录

### 3. 测试功能
1. 查看不同状态的显示
2. 测试评分功能
3. 验证锁定状态显示

## 故障排除

### 问题1：SQL 执行失败
**可能原因**：
- 用户表为空
- 权限不足
- 语法错误

**解决**：
```sql
-- 检查用户表
SELECT COUNT(*) FROM users_profile;

-- 如果用户表为空，先插入测试用户
INSERT INTO users_profile (user_id, nickname, email, role, is_active)
VALUES 
  ('test-user-1', '测试用户1', 'test1@example.com', 'manager', true),
  ('test-user-2', '测试用户2', 'test2@example.com', 'manager', true),
  ('test-user-3', '测试用户3', 'test3@example.com', 'manager', true);
```

### 问题2：前端仍显示无数据
**可能原因**：
- 数据插入失败
- 前端缓存问题
- API 调用问题

**解决**：
1. 检查浏览器控制台错误
2. 使用前端调试功能
3. 清除浏览器缓存

### 问题3：RLS 策略问题
**可能原因**：
- RLS 策略阻止查询
- 用户权限不足

**解决**：
```sql
-- 检查 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'live_stream_schedules';

-- 临时禁用 RLS（仅用于测试）
ALTER TABLE live_stream_schedules DISABLE ROW LEVEL SECURITY;
```

## 安全注意事项

1. **测试环境**：仅在测试环境中禁用 RLS
2. **数据清理**：测试完成后清理测试数据
3. **权限控制**：确保生产环境有适当的权限控制

## 清理测试数据

测试完成后，可以清理测试数据：

```sql
-- 删除测试数据
DELETE FROM live_stream_schedules 
WHERE date >= '2025-01-15' AND date <= '2025-01-18';
```

## 总结

通过以上步骤，您应该能够成功插入测试数据并在前端查看。如果遇到问题，请按照故障排除步骤进行检查。 