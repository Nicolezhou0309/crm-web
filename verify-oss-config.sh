#!/bin/bash

echo "🔍 验证阿里云 OSS 配置..."

# 检查环境变量是否正确注入
if [ -d "dist/assets" ]; then
    echo "✅ 构建文件存在"
    
    # 查找实际的构建文件
    INDEX_JS=$(find dist/assets -name "index-*.js" | head -1)
    SUPABASE_JS=$(find dist/assets -name "supabase-*.js" | head -1)
    
    if [ -n "$INDEX_JS" ]; then
        echo "📁 找到主文件: $INDEX_JS"
        
        # 检查是否包含 Supabase URL
        if grep -q "47.123.26.25:8000" "$INDEX_JS"; then
            echo "✅ Supabase URL 已正确注入到主文件"
        else
            echo "❌ Supabase URL 未在主文件中找到"
        fi
        
        # 检查是否包含 Anon Key
        if grep -q "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9" "$INDEX_JS"; then
            echo "✅ Supabase Anon Key 已正确注入到主文件"
        else
            echo "❌ Supabase Anon Key 未在主文件中找到"
        fi
    fi
    
    if [ -n "$SUPABASE_JS" ]; then
        echo "📁 找到 Supabase 文件: $SUPABASE_JS"
        
        # 检查 Supabase 文件中的配置
        if grep -q "47.123.26.25:8000" "$SUPABASE_JS"; then
            echo "✅ Supabase URL 已正确注入到 Supabase 文件"
        else
            echo "❌ Supabase URL 未在 Supabase 文件中找到"
        fi
    fi
    
    # 检查 HTML 文件中的环境变量
    if [ -f "dist/index.html" ]; then
        echo "📁 检查 HTML 文件中的环境变量"
        if grep -q "47.123.26.25:8000" dist/index.html; then
            echo "✅ Supabase URL 在 HTML 文件中找到"
        else
            echo "ℹ️ Supabase URL 未在 HTML 文件中找到（这是正常的，因为环境变量在 JS 中）"
        fi
    fi
else
    echo "❌ 构建文件不存在，请先运行 npm run build"
fi

echo "📋 配置验证完成"
