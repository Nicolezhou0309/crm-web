-- 为user_points_wallet表添加RLS权限控制

-- 启用RLS
ALTER TABLE public.user_points_wallet ENABLE ROW LEVEL SECURITY;

-- INSERT 权限：只允许积分管理权限新增
CREATE POLICY "user_points_wallet_insert_policy" ON public.user_points_wallet
FOR INSERT TO public
WITH CHECK (
  has_permission('points', 'manage')
);

-- DELETE 权限：只允许积分管理权限删除
CREATE POLICY "user_points_wallet_delete_policy" ON public.user_points_wallet
FOR DELETE TO public
USING (
  has_permission('points', 'manage')
);

-- UPDATE 权限：只允许积分管理权限修改
CREATE POLICY "user_points_wallet_update_policy" ON public.user_points_wallet
FOR UPDATE TO public
USING (
  has_permission('points', 'manage')
)
WITH CHECK (
  has_permission('points', 'manage')
);

-- SELECT 权限：本人可以查看自己的积分，管理员可以查看递归组织成员，积分管理权限可以查所有人
CREATE POLICY "user_points_wallet_select_policy" ON public.user_points_wallet
FOR SELECT TO public
USING (
  -- 积分管理权限可以查看所有人
  has_permission('points', 'manage')
  OR
  -- 用户查看自己的积分
  user_id = (
    SELECT id FROM users_profile WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员查看递归子部门所有人的积分
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = user_points_wallet.user_id
  )
);

-- 添加注释
COMMENT ON POLICY "user_points_wallet_insert_policy" ON public.user_points_wallet IS '只允许积分管理权限新增积分钱包记录';
COMMENT ON POLICY "user_points_wallet_delete_policy" ON public.user_points_wallet IS '只允许积分管理权限删除积分钱包记录';
COMMENT ON POLICY "user_points_wallet_update_policy" ON public.user_points_wallet IS '只允许积分管理权限修改积分钱包记录';
COMMENT ON POLICY "user_points_wallet_select_policy" ON public.user_points_wallet IS '本人可查看自己的积分，管理员可查看递归组织成员，积分管理权限可查看所有人'; 