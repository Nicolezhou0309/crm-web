#!/usr/bin/env node

/**
 * 阿里云OSS自动部署脚本
 * 使用阿里云OSS API直接上传文件
 * 
 * 使用方法:
 * node deploy-with-api.js
 * 
 * 或者设置环境变量:
 * ACCESS_KEY_ID=your_key_id ACCESS_KEY_SECRET=your_secret BUCKET_NAME=your_bucket REGION=oss-cn-shanghai node deploy-with-api.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { execSync } from 'child_process';

// 配置信息
const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    bucketName: process.env.BUCKET_NAME || 'crm-web-frontend',
    region: process.env.REGION || 'oss-cn-shanghai',
    endpoint: process.env.ENDPOINT || `https://${process.env.BUCKET_NAME || 'crm-web-frontend'}.${process.env.REGION || 'oss-cn-shanghai'}.aliyuncs.com`
};

// 颜色输出
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查配置
function checkConfig() {
    if (!config.accessKeyId || !config.accessKeySecret) {
        log('❌ 请设置阿里云AccessKey信息', 'red');
        log('方法1: 设置环境变量', 'yellow');
        log('  export ACCESS_KEY_ID=your_access_key_id', 'yellow');
        log('  export ACCESS_KEY_SECRET=your_access_key_secret', 'yellow');
        log('  export BUCKET_NAME=your_bucket_name', 'yellow');
        log('  export REGION=oss-cn-shanghai', 'yellow');
        log('', 'yellow');
        log('方法2: 在脚本中直接设置', 'yellow');
        log('  修改脚本顶部的config对象', 'yellow');
        process.exit(1);
    }
    
    log('✅ 配置检查通过', 'green');
    log(`存储桶: ${config.bucketName}`, 'blue');
    log(`区域: ${config.region}`, 'blue');
    log(`端点: ${config.endpoint}`, 'blue');
}

// 构建项目
function buildProject() {
    log('📦 开始构建项目...', 'blue');
    
    try {
        // 检查是否存在dist目录，如果存在则删除
        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true, force: true });
        }
        
        // 执行构建命令
        execSync('npm run build', { stdio: 'inherit' });
        log('✅ 项目构建完成', 'green');
    } catch (error) {
        log('❌ 项目构建失败', 'red');
        log(error.message, 'red');
        process.exit(1);
    }
}

// 生成签名
function generateSignature(method, resource, headers, date) {
    const stringToSign = [
        method,
        headers['Content-MD5'] || '',
        headers['Content-Type'] || '',
        date,
        Object.keys(headers)
            .filter(key => key.toLowerCase().startsWith('x-oss-'))
            .sort()
            .map(key => `${key.toLowerCase()}:${headers[key]}`)
            .join('\n') + (Object.keys(headers).some(key => key.toLowerCase().startsWith('x-oss-')) ? '\n' : '') +
        resource
    ].join('\n');
    
    const signature = crypto
        .createHmac('sha1', config.accessKeySecret)
        .update(stringToSign)
        .digest('base64');
    
    return signature;
}

// 上传文件到OSS
function uploadFile(filePath, objectKey) {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const contentType = getContentType(fileName);
        
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/${objectKey}`;
        
        const headers = {
            'Content-Type': contentType,
            'Content-Length': fileContent.length.toString(),
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: `/${objectKey}`,
            method: 'PUT',
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    reject(new Error(`上传失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(fileContent);
        req.end();
    });
}

// 获取文件MIME类型
function getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
    };
    
    return types[ext] || 'application/octet-stream';
}

// 递归获取所有文件
function getAllFiles(dir, baseDir = '') {
    let files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(baseDir, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
            files = files.concat(getAllFiles(fullPath, relativePath));
        } else {
            files.push({
                localPath: fullPath,
                objectKey: relativePath.replace(/\\/g, '/') // 确保使用正斜杠
            });
        }
    }
    
    return files;
}

// 设置静态网站托管
function setWebsiteHosting() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?website`;
        
        const websiteConfig = `<?xml version="1.0" encoding="UTF-8"?>
<WebsiteConfiguration>
    <IndexDocument>
        <Suffix>index.html</Suffix>
    </IndexDocument>
    <ErrorDocument>
        <Key>index.html</Key>
    </ErrorDocument>
</WebsiteConfiguration>`;
        
        const headers = {
            'Content-Type': 'application/xml',
            'Content-Length': Buffer.byteLength(websiteConfig).toString(),
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/?website',
            method: 'PUT',
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    reject(new Error(`设置静态网站托管失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(websiteConfig);
        req.end();
    });
}

// 主函数
async function main() {
    try {
        log('🚀 开始部署CRM系统到阿里云OSS...', 'blue');
        log('=====================================', 'blue');
        
        // 1. 检查配置
        checkConfig();
        
        // 2. 构建项目
        buildProject();
        
        // 3. 获取所有文件
        log('📁 扫描构建文件...', 'blue');
        const files = getAllFiles('dist');
        log(`✅ 找到 ${files.length} 个文件`, 'green');
        
        // 4. 上传文件
        log('☁️  开始上传文件到OSS...', 'blue');
        let successCount = 0;
        let failCount = 0;
        
        for (const file of files) {
            try {
                await uploadFile(file.localPath, file.objectKey);
                log(`✅ ${file.objectKey}`, 'green');
                successCount++;
            } catch (error) {
                log(`❌ ${file.objectKey}: ${error.message}`, 'red');
                failCount++;
            }
        }
        
        log(`📊 上传完成: 成功 ${successCount} 个，失败 ${failCount} 个`, 'blue');
        
        if (failCount > 0) {
            log('⚠️  部分文件上传失败，请检查网络连接和权限设置', 'yellow');
        }
        
        // 5. 设置静态网站托管
        log('🌐 配置静态网站托管...', 'blue');
        try {
            await setWebsiteHosting();
            log('✅ 静态网站托管配置完成', 'green');
        } catch (error) {
            log(`⚠️  静态网站托管配置失败: ${error.message}`, 'yellow');
        }
        
        // 6. 显示访问信息
        log('🎉 部署完成！', 'green');
        log('=====================================', 'blue');
        log('📱 访问信息:', 'blue');
        log(`OSS访问地址: http://${config.bucketName}.${config.region}.aliyuncs.com`, 'green');
        log(`存储桶名称: ${config.bucketName}`, 'blue');
        log(`区域: ${config.region}`, 'blue');
        log('', 'reset');
        log('🔧 后续配置建议:', 'yellow');
        log('1. 绑定自定义域名', 'yellow');
        log('2. 配置SSL证书（HTTPS）', 'yellow');
        log('3. 设置CDN加速', 'yellow');
        log('4. 配置缓存策略', 'yellow');
        
    } catch (error) {
        log(`❌ 部署失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

// 运行主函数
main();
