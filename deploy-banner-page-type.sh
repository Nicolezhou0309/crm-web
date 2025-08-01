#!/bin/bash

echo "🚀 开始部署banner页面类型功能..."

# 应用数据库迁移
echo "📦 应用数据库迁移..."
supabase db push

echo "✅ banner页面类型功能部署完成！"
echo ""
echo "📋 功能说明："
echo "1. 数据库表已添加 page_type 字段"
echo "2. BannerManagement 页面已支持按页面类型管理banner"
echo "3. LiveStreamRegistration 页面已添加banner显示功能"
echo ""
echo "🎯 使用方法："
echo "- 在 BannerManagement 页面可以创建不同页面类型的banner"
echo "- 直播报名页面会自动显示对应的banner"
echo "- 支持轮播、点击跳转等功能" 