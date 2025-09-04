#!/usr/bin/env node

const OSS = require('aliyun-oss');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 阿里云OSS配置
const client = new OSS({
  region: 'cn-shanghai', // 根据您的实际区域修改
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: 'your-bucket-name' // 需要您提供实际的bucket名称
});

async function uploadFiles() {
  try {
    console.log('🚀 开始上传文件到阿里云OSS...');
    
    const distDir = path.join(__dirname, 'dist');
    const files = getAllFiles(distDir);
    
    for (const file of files) {
      const relativePath = path.relative(distDir, file);
      const objectName = `crm-web/${relativePath}`;
      
      console.log(`📤 上传: ${relativePath}`);
      
      await client.put(objectName, file);
    }
    
    console.log('✅ 所有文件上传完成！');
    console.log('🌐 访问地址: https://your-bucket-name.oss-cn-shanghai.aliyuncs.com/crm-web/');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    process.exit(1);
  }
}

function getAllFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 运行上传
uploadFiles();
