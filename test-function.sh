#!/bin/bash

echo "测试 email-management Edge Function..."

# 检查函数是否可访问
echo "1. 检查函数是否可访问..."
response=$(curl -s -w "%{http_code}" -o /tmp/test_response.json \
  -X POST https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/email-management \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{"action": "test"}')

echo "HTTP状态码: $response"

if [ "$response" = "401" ]; then
    echo "✅ 函数正常运行 (返回401表示需要认证，这是正确的)"
elif [ "$response" = "400" ]; then
    echo "✅ 函数正常运行 (返回400表示参数错误)"
else
    echo "❌ 函数可能有问题，状态码: $response"
    echo "响应内容:"
    cat /tmp/test_response.json
fi

echo ""
echo "2. 测试CORS预检请求..."
cors_response=$(curl -s -w "%{http_code}" -o /dev/null \
  -X OPTIONS https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/email-management)

if [ "$cors_response" = "200" ]; then
    echo "✅ CORS配置正常"
else
    echo "❌ CORS配置可能有问题，状态码: $cors_response"
fi

# 清理临时文件
rm -f /tmp/test_response.json

echo ""
echo "测试完成！" 