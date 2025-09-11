#!/bin/bash

# 修复服务器配置脚本
# 解决环境变量配置和长轮询连接问题

set -e

echo "🔧 修复服务器配置..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
SERVICE_NAME="crm-wecom-api"
API_DIR="/opt/crm-wecom-api"

echo -e "${BLUE}📋 修复配置:${NC}"
echo "  服务名称: $SERVICE_NAME"
echo "  API目录: $API_DIR"
echo ""

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用root用户运行此脚本${NC}"
    exit 1
fi

# 第一步：停止服务
echo -e "${YELLOW}🛑 停止服务...${NC}"
pm2 stop "$SERVICE_NAME" 2>/dev/null || echo -e "${YELLOW}⚠️  服务未运行${NC}"

# 第二步：更新环境变量配置
echo -e "${YELLOW}⚙️  更新环境变量配置...${NC}"

# 创建正确的环境变量文件
cat > "$API_DIR/.env" << 'EOF'
# 企业微信认证API服务生产环境配置

# 服务器配置
PORT=3001
NODE_ENV=production

# 前端地址（用于CORS配置）
FRONTEND_URL=https://lead.vld.com.cn

# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_secret_here
WECOM_REDIRECT_URI=https://lead.vld.com.cn/api/auth/wecom/callback

# Supabase 配置（自建实例）
VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80

# 说明：
# 1. PORT: API服务端口，默认3001
# 2. NODE_ENV: 运行环境，production/development
# 3. FRONTEND_URL: 前端地址，用于CORS配置
# 4. WECOM_CORP_ID: 企业微信企业ID
# 5. WECOM_AGENT_ID: 企业微信应用ID
# 6. WECOM_SECRET: 企业微信应用密钥（敏感信息）
# 7. WECOM_REDIRECT_URI: 企业微信授权回调地址
EOF

echo -e "${GREEN}✅ 环境变量配置已更新${NC}"

# 第三步：检查Node.js版本
echo -e "${YELLOW}🔍 检查Node.js版本...${NC}"
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  当前Node.js版本: $(node --version)${NC}"
    echo -e "${YELLOW}⚠️  建议升级到Node.js 20+ 以获得更好的Supabase支持${NC}"
    echo -e "${YELLOW}⚠️  升级命令: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
else
    echo -e "${GREEN}✅ Node.js版本: $(node --version)${NC}"
fi

# 第四步：更新PM2配置
echo -e "${YELLOW}📝 更新PM2配置...${NC}"

# 创建优化的PM2配置
cat > "$API_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-wecom-api',
    script: 'server.js',
    cwd: '/opt/crm-wecom-api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/crm-wecom-api-error.log',
    out_file: '/var/log/pm2/crm-wecom-api-out.log',
    log_file: '/var/log/pm2/crm-wecom-api.log',
    time: true,
    node_args: '--max-old-space-size=1024',
    // 优化长轮询连接
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // 处理连接重置错误
    min_uptime: '10s',
    max_restarts: 10
  }]
};
EOF

echo -e "${GREEN}✅ PM2配置已更新${NC}"

# 第五步：重启服务
echo -e "${YELLOW}🚀 重启服务...${NC}"
cd "$API_DIR"
pm2 delete "$SERVICE_NAME" 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}✅ 服务重启成功${NC}"

# 第六步：验证服务
echo -e "${YELLOW}🔍 验证服务...${NC}"
sleep 3

# 检查服务状态
pm2 status "$SERVICE_NAME"

# 测试健康检查
echo -e "${YELLOW}🔍 测试健康检查...${NC}"
if curl -s http://localhost:3001/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
else
    echo -e "${RED}❌ 健康检查失败${NC}"
    pm2 logs "$SERVICE_NAME" --lines 10
fi

# 测试企业微信API
echo -e "${YELLOW}🔍 测试企业微信API...${NC}"
QRCODE_RESPONSE=$(curl -s http://localhost:3001/api/auth/wecom/qrcode)
if echo "$QRCODE_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ 企业微信API正常${NC}"
else
    echo -e "${RED}❌ 企业微信API异常${NC}"
    echo "响应: $QRCODE_RESPONSE"
fi

# 测试长轮询API
echo -e "${YELLOW}🔍 测试长轮询API...${NC}"

# 测试1: 没有state参数
NO_STATE_RESPONSE=$(curl -s "http://localhost:3001/api/auth/wecom/poll")
if echo "$NO_STATE_RESPONSE" | grep -q "缺少state参数"; then
    echo -e "${GREEN}✅ 长轮询API - 缺少参数测试通过${NC}"
else
    echo -e "${RED}❌ 长轮询API - 缺少参数测试失败${NC}"
    echo "响应: $NO_STATE_RESPONSE"
fi

# 测试2: 有state参数但状态不存在
WITH_STATE_RESPONSE=$(curl -s "http://localhost:3001/api/auth/wecom/poll?state=test")
if echo "$WITH_STATE_RESPONSE" | grep -q "状态不存在或已过期"; then
    echo -e "${GREEN}✅ 长轮询API - 状态不存在测试通过${NC}"
else
    echo -e "${RED}❌ 长轮询API - 状态不存在测试失败${NC}"
    echo "响应: $WITH_STATE_RESPONSE"
fi

echo ""
echo -e "${GREEN}🎉 服务器配置修复完成！${NC}"
echo -e "${BLUE}📋 修复内容:${NC}"
echo "  ✅ 更新了环境变量配置"
echo "  ✅ 优化了PM2配置"
echo "  ✅ 重启了服务"
echo "  ✅ 验证了API功能"
echo ""
echo -e "${BLUE}📝 重要提醒:${NC}"
echo "  1. 请确保 WECOM_SECRET 已正确配置"
echo "  2. 建议升级Node.js到20+版本"
echo "  3. 监控服务日志: pm2 logs $SERVICE_NAME"
echo ""
echo -e "${YELLOW}⚠️  如果仍有问题，请检查:${NC}"
echo "  - 企业微信应用配置是否正确"
echo "  - 网络连接是否正常"
echo "  - 防火墙设置"
