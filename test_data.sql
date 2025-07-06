-- 插入测试部门
INSERT INTO public.organizations (id, name, parent_id) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '技术部', NULL),
  ('550e8400-e29b-41d4-a716-446655440002', '销售部', NULL),
  ('550e8400-e29b-41d4-a716-446655440003', '人事部', NULL),
  ('550e8400-e29b-41d4-a716-446655440004', '前端组', '550e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440005', '后端组', '550e8400-e29b-41d4-a716-446655440001');

-- 设置部门管理员（需要先有用户数据）
-- 假设用户ID为 'user1', 'user2'
-- UPDATE public.organizations SET admin = 'user1' WHERE id = '550e8400-e29b-41d4-a716-446655440001';
-- UPDATE public.organizations SET admin = 'user2' WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- 插入测试用户档案
INSERT INTO public.users_profile (user_id, nickname, email, organization_id, status) VALUES
  ('test-user-1', '张三', 'zhangsan@example.com', '550e8400-e29b-41d4-a716-446655440001', 'active'),
  ('test-user-2', '李四', 'lisi@example.com', '550e8400-e29b-41d4-a716-446655440002', 'active'),
  ('test-user-3', '王五', 'wangwu@example.com', '550e8400-e29b-41d4-a716-446655440003', 'active'),
  ('test-user-4', '赵六', 'zhaoliu@example.com', '550e8400-e29b-41d4-a716-446655440004', 'active'),
  ('test-user-5', '钱七', 'qianqi@example.com', '550e8400-e29b-41d4-a716-446655440005', 'active'); 