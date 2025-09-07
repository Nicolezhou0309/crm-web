#!/bin/bash

# 企业微信API服务部署脚本
# 使用方法: ./deploy-backend.sh

echo "=== 企业微信API服务部署脚本 ==="

# 服务器信息
SERVER_IP="8.159.132.181"
SERVER_USER="root"
PACKAGE_NAME="crm-wecom-api-fixed-20250907-154346.tar.gz"

echo "1. 上传部署包到服务器..."
scp build/$PACKAGE_NAME $SERVER_USER@$SERVER_IP:/opt/

echo "2. 连接到服务器执行部署..."
ssh $SERVER_USER@$SERVER_IP << 'REMOTE_SCRIPT'
    echo "=== 在服务器上执行部署 ==="
    
    # 进入目录
    cd /opt
    
    # 解压部署包
    echo "解压部署包..."
    tar -xzf $PACKAGE_NAME
    
    # 进入服务目录
    cd crm-wecom-api
    
    # 设置执行权限
    chmod +x aliyun-existing-env-deploy.sh
    
    # 执行部署脚本
    echo "执行部署脚本..."
    ./aliyun-existing-env-deploy.sh
    
    # 检查服务状态
    echo "检查服务状态..."
    pm2 status
    
    # 测试API
    echo "测试API健康检查..."
    curl -s https://lead-service.vld.com.cn/api/health
    
    echo "测试企业微信API..."
    curl -s https://lead-service.vld.com.cn/api/auth/wecom/qrcode | head -c 200
    
    echo "=== 部署完成 ==="
REMOTE_SCRIPT

echo "=== 部署脚本执行完成 ==="
echo "请检查上面的输出确认部署是否成功"
