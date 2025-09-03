#!/bin/bash

# 阿里云函数计算部署脚本
# 使用方法：./deploy-to-function-compute.sh

echo "🚀 开始部署到阿里云函数计算..."

# 设置PATH
export PATH="$HOME/bin:$PATH"

# 检查阿里云CLI是否可用
if ! command -v aliyun &> /dev/null; then
    echo "❌ 阿里云CLI未找到，请先安装"
    exit 1
fi

# 检查构建文件是否存在
if [ ! -d "dist" ]; then
    echo "❌ dist目录不存在，请先运行 npm run build"
    exit 1
fi

echo "✅ 构建文件检查完成"

# 创建函数计算项目目录
FC_DIR="aliyun-fc-frontend"
if [ -d "$FC_DIR" ]; then
    echo "🗑️ 清理旧的函数计算目录..."
    rm -rf "$FC_DIR"
fi

echo "📁 创建函数计算项目目录..."
mkdir -p "$FC_DIR"
cd "$FC_DIR"

# 创建package.json
echo "📦 创建package.json..."
cat > package.json << 'EOF'
{
  "name": "crm-frontend-fc",
  "version": "1.0.0",
  "description": "CRM前端应用 - 函数计算版本",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "deploy": "fun deploy"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# 创建函数入口文件
echo "🔧 创建函数入口文件..."
cat > index.js << 'EOF'
const express = require('express');
const path = require('path');

const app = express();

// 设置环境变量（从函数计算环境变量中获取）
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE';

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// 环境变量API端点（用于前端获取配置）
app.get('/api/config', (req, res) => {
  res.json({
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    VITE_APP_ENV: 'production',
    VITE_APP_VERSION: '1.0.0'
  });
});

// SPA路由支持 - 所有其他请求都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 函数计算入口
module.exports.handler = (event, context, callback) => {
  // 处理HTTP事件
  if (event.httpMethod) {
    // 这是HTTP触发器
    const server = app.listen(0, () => {
      const port = server.address().port;
      
      // 模拟HTTP请求
      const req = {
        method: event.httpMethod,
        url: event.path,
        headers: event.headers || {},
        body: event.body
      };
      
      const res = {
        statusCode: 200,
        headers: {},
        body: '',
        setHeader: function(name, value) {
          this.headers[name] = value;
        },
        writeHead: function(statusCode, headers) {
          this.statusCode = statusCode;
          if (headers) {
            Object.assign(this.headers, headers);
          }
        },
        write: function(data) {
          this.body += data;
        },
        end: function(data) {
          if (data) {
            this.body += data;
          }
          server.close();
          callback(null, {
            statusCode: this.statusCode,
            headers: this.headers,
            body: this.body
          });
        }
      };
      
      app(req, res);
    });
  } else {
    // 其他类型的事件
    callback(null, { message: 'Function executed successfully' });
  }
};
EOF

# 创建template.yml
echo "📋 创建template.yml..."
cat > template.yml << 'EOF'
ROSTemplateFormatVersion: '2015-09-01'
Transform: 'Aliyun::Serverless-2018-04-03'

Resources:
  crm-frontend:
    Type: 'Aliyun::Serverless::Service'
    Properties:
      Description: 'CRM前端应用服务'
      Policies:
        - AliyunOSSFullAccess
        - AliyunLogFullAccess
    
    crm-frontend-app:
      Type: 'Aliyun::Serverless::Function'
      Properties:
        Description: 'CRM前端应用函数'
        CodeUri: './'
        Handler: index.handler
        Runtime: nodejs18
        MemorySize: 512
        Timeout: 30
        EnvironmentVariables:
          VITE_SUPABASE_URL: 'http://47.123.26.25:8000'
          VITE_SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE'
          VITE_APP_ENV: 'production'
          VITE_APP_VERSION: '1.0.0'
      Events:
        http-trigger:
          Type: HTTP
          Properties:
            AuthType: ANONYMOUS
            Methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']
            Path: '/{proxy+}'
EOF

# 复制构建文件
echo "📁 复制构建文件..."
cp -r ../dist ./

# 安装依赖
echo "📦 安装依赖..."
npm install

# 配置信息
echo "📋 请提供以下配置信息："
read -p "请输入您的 Access Key ID: " ACCESS_KEY_ID
read -p "请输入您的 Access Key Secret: " ACCESS_KEY_SECRET
read -p "请输入函数计算区域 (如: cn-shanghai): " FC_REGION

# 验证输入
if [ -z "$ACCESS_KEY_ID" ] || [ -z "$ACCESS_KEY_SECRET" ] || [ -z "$FC_REGION" ]; then
    echo "❌ 配置信息不完整，请重新运行脚本"
    exit 1
fi

# 配置阿里云CLI
echo "🔧 配置阿里云CLI..."
aliyun configure set \
    --profile default \
    --mode AK \
    --access-key-id "$ACCESS_KEY_ID" \
    --access-key-secret "$ACCESS_KEY_SECRET" \
    --region "$FC_REGION" \
    --language zh

if [ $? -ne 0 ]; then
    echo "❌ 阿里云CLI配置失败"
    exit 1
fi

echo "✅ 阿里云CLI配置完成"

# 安装Fun工具
echo "🛠️ 安装Fun工具..."
npm install -g @alicloud/fun

if [ $? -ne 0 ]; then
    echo "❌ Fun工具安装失败"
    exit 1
fi

# 配置Fun工具
echo "🔧 配置Fun工具..."
fun config set aliyun_access_key_id "$ACCESS_KEY_ID"
fun config set aliyun_access_key_secret "$ACCESS_KEY_SECRET"
fun config set aliyun_region "$FC_REGION"

# 部署函数
echo "🚀 开始部署函数..."
fun deploy --use-ros

if [ $? -ne 0 ]; then
    echo "❌ 函数部署失败"
    exit 1
fi

echo "🎉 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 在阿里云控制台查看函数计算服务"
echo "2. 获取HTTP触发器的访问地址"
echo "3. 测试应用是否正常工作"
echo "4. 测试登录功能是否正常"
echo ""
echo "🔧 如需更新环境变量，请在函数计算控制台直接修改"
echo "📊 如需查看日志，请在函数计算控制台查看执行日志"
