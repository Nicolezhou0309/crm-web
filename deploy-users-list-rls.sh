#!/bin/bash

# 部署 users_list 表的 RLS 策略
echo "正在部署 users_list 表的 RLS 策略..."

# 检查 Supabase 连接
if ! supabase status > /dev/null 2>&1; then
    echo "错误：无法连接到 Supabase，请确保已启动 Supabase"
    exit 1
fi

# 应用 RLS 策略
echo "应用 RLS 策略..."
supabase db reset --linked

# 或者使用 SQL 文件直接应用
# supabase db push

echo "RLS 策略部署完成！"
echo ""
echo "策略总结："
echo "- 插入：需要 allocation_manage 权限"
echo "- 删除：需要 allocation_manage 权限"
echo "- 更新：允许所有注册用户"
echo "- 查询：允许所有注册用户" 