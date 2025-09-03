#!/usr/bin/env node

/**
 * 构建函数计算应用脚本
 * 将Vite构建的文件复制到函数计算项目结构中
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🚀 开始构建函数计算应用...');

// 函数计算应用目录
const fcAppDir = path.join(projectRoot, 'fc-app');

// 确保函数计算应用目录存在
if (!fs.existsSync(fcAppDir)) {
  fs.mkdirSync(fcAppDir, { recursive: true });
  console.log('📁 创建函数计算应用目录');
}

// 复制文件列表
const filesToCopy = [
  { src: 'fc-package.json', dest: 'package.json' },
  { src: 'fc-index.js', dest: 'index.js' },
  { src: 'template.yml', dest: 'template.yml' },
  { src: 'template-dev.yml', dest: 'template-dev.yml' },
  { src: 'template-prod.yml', dest: 'template-prod.yml' },
  { src: 'fc-test.js', dest: 'test.js' }
];

// 复制配置文件
console.log('📋 复制配置文件...');
filesToCopy.forEach(({ src, dest }) => {
  const srcPath = path.join(projectRoot, src);
  const destPath = path.join(fcAppDir, dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✅ ${src} → ${dest}`);
  } else {
    console.log(`  ⚠️  ${src} 不存在，跳过`);
  }
});

// 复制构建文件
const distDir = path.join(projectRoot, 'dist');
const fcDistDir = path.join(fcAppDir, 'dist');

if (fs.existsSync(distDir)) {
  console.log('📁 复制构建文件...');
  
  // 删除旧的dist目录
  if (fs.existsSync(fcDistDir)) {
    fs.rmSync(fcDistDir, { recursive: true, force: true });
  }
  
  // 复制新的dist目录
  fs.cpSync(distDir, fcDistDir, { recursive: true });
  console.log('  ✅ dist/ → fc-app/dist/');
  
  // 验证关键文件
  const indexHtmlPath = path.join(fcDistDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log('  ✅ index.html 存在');
  } else {
    console.log('  ❌ index.html 不存在');
    process.exit(1);
  }
  
  // 统计文件数量
  const countFiles = (dir) => {
    let count = 0;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        count += countFiles(filePath);
      } else {
        count++;
      }
    });
    return count;
  };
  
  const fileCount = countFiles(fcDistDir);
  console.log(`  📊 共复制 ${fileCount} 个文件`);
  
} else {
  console.log('❌ dist目录不存在，请先运行 npm run build');
  process.exit(1);
}

// 创建package.json（如果不存在）
const fcPackageJsonPath = path.join(fcAppDir, 'package.json');
if (!fs.existsSync(fcPackageJsonPath)) {
  console.log('📦 创建package.json...');
  
  const packageJson = {
    "name": "crm-fc-app",
    "version": "1.0.0",
    "description": "CRM前端应用 - 函数计算版本",
    "main": "index.js",
    "type": "commonjs",
    "scripts": {
      "start": "node index.js",
      "dev": "node index.js",
      "deploy": "fun deploy --use-ros",
      "deploy:dev": "fun deploy --use-ros --template template-dev.yml",
      "deploy:prod": "fun deploy --use-ros --template template-prod.yml",
      "test": "node test.js"
    },
    "dependencies": {
      "express": "^4.18.2",
      "cors": "^2.8.5",
      "helmet": "^7.1.0",
      "compression": "^1.7.4",
      "morgan": "^1.10.0",
      "dotenv": "^16.3.1"
    },
    "devDependencies": {
      "@alicloud/fun": "^3.6.0"
    },
    "engines": {
      "node": ">=18.0.0"
    },
    "keywords": [
      "crm",
      "function-compute",
      "vite",
      "react",
      "supabase"
    ],
    "author": "Nicole Zhou",
    "license": "MIT"
  };
  
  fs.writeFileSync(fcPackageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('  ✅ package.json 创建完成');
}

// 创建.gitignore文件
const gitignorePath = path.join(fcAppDir, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  console.log('📝 创建.gitignore...');
  
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Function Compute
.fun/
.ros/

# Logs
logs
*.log

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;
  
  fs.writeFileSync(gitignorePath, gitignoreContent);
  console.log('  ✅ .gitignore 创建完成');
}

// 创建README文件
const readmePath = path.join(fcAppDir, 'README.md');
if (!fs.existsSync(readmePath)) {
  console.log('📖 创建README.md...');
  
  const readmeContent = `# CRM前端应用 - 函数计算版本

这是CRM前端应用的函数计算版本。

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 部署到开发环境
npm run deploy:dev

# 部署到生产环境
npm run deploy:prod

# 测试
npm test
\`\`\`

## 环境变量

在template.yml中配置环境变量：

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_ENV
- VITE_APP_VERSION

## 部署

使用Fun工具部署到阿里云函数计算：

\`\`\`bash
fun deploy --use-ros
\`\`\`
`;
  
  fs.writeFileSync(readmePath, readmeContent);
  console.log('  ✅ README.md 创建完成');
}

console.log('🎉 函数计算应用构建完成！');
console.log('');
console.log('📋 下一步：');
console.log('1. cd fc-app');
console.log('2. npm install');
console.log('3. fun config (配置阿里云凭证)');
console.log('4. npm run deploy:dev (部署到开发环境)');
console.log('5. npm run deploy:prod (部署到生产环境)');
console.log('');
console.log('📁 项目结构：');
console.log('fc-app/');
console.log('├── package.json');
console.log('├── index.js');
console.log('├── template.yml');
console.log('├── dist/');
console.log('└── node_modules/');
