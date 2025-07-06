#!/bin/bash

echo "🚀 部署 invite-user Edge Function"
echo "项目: wteqgprgiylmxzszcnws"
echo ""

echo "📋 部署步骤："
echo "1. 访问 https://supabase.com/dashboard"
echo "2. 选择项目 wteqgprgiylmxzszcnws"
echo "3. 进入 Edge Functions"
echo "4. 点击 'Create Function'"
echo "5. 函数名称: invite-user"
echo "6. 复制以下代码到编辑器："
echo ""

echo "📁 代码文件位置: supabase/functions/invite-user/index.ts"
echo ""

echo "🔧 环境变量配置："
echo "SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co"
echo "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI"
echo "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTE3Nzk4MSwiZXhwIjoyMDY2NzUzOTgxfQ.Mm3-pQUxKFvrQ96K_R8uxaLPjm3iPrrTlB2oVXli1Mc"
echo ""

echo "🧪 部署完成后测试："
echo "curl -s -w \"%{http_code}\" -X OPTIONS https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/invite-user"
echo ""

echo "✅ 部署完成后，应该返回 200 状态码"
echo ""

echo "🔗 直接访问 Dashboard："
echo "https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/functions" 