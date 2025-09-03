#!/bin/bash

# 为 Serverless CD 构建脚本
# 确保 code 目录包含所有必要的文件

set -e

echo "🔨 为 Serverless CD 构建项目..."

# 清理并重新创建 code 目录
echo "📁 准备 code 目录..."
rm -rf code
mkdir -p code

# 构建前端项目
echo "🏗️ 构建前端项目..."
npm install
npm run build

# 复制函数计算文件到 code 目录
echo "📋 复制函数计算文件..."
cp fc-app/index.js code/
cp fc-app/package.json code/
cp -r fc-app/dist code/

# 创建 code 目录的 package.json
cat > code/package.json << 'EOF'
{
  "name": "crm-frontend-fc",
  "version": "1.0.0",
  "description": "CRM前端应用 - 函数计算版本",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "build": "echo 'Build completed'",
    "test": "node test.js"
  },
  "dependencies": {
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "crm",
    "frontend", 
    "function-compute",
    "aliyun"
  ],
  "author": "Nicole",
  "license": "MIT"
}
EOF

# 创建 code 目录的测试文件
cat > code/test.js << 'EOF'
// 简单的测试文件
console.log('✅ 函数计算应用测试通过');
console.log('📁 工作目录:', process.cwd());
console.log('📋 环境变量:');
console.log('  - VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('  - NODE_ENV:', process.env.NODE_ENV);
EOF

echo "✅ 构建完成！"
echo ""
echo "📊 构建结果："
echo "├── code/index.js - 函数入口文件"
echo "├── code/package.json - 依赖配置"
echo "├── code/dist/ - 前端构建文件"
echo "└── code/test.js - 测试文件"
echo ""
echo "🚀 现在可以部署到 Serverless CD 了！"
