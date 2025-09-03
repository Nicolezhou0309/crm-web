#!/usr/bin/env node

/**
 * 修复OSS存储桶权限脚本
 * 设置存储桶为公共读权限
 */

import crypto from 'crypto';
import https from 'https';

// 配置信息
const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    bucketName: process.env.BUCKET_NAME || 'vlinker-crm',
    region: process.env.REGION || 'oss-cn-shanghai'
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

// 设置存储桶ACL为公共读
function setBucketACL() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?acl`;
        
        const headers = {
            'Content-Type': 'application/xml',
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`,
            'x-oss-acl': 'public-read'
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/?acl',
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
                    reject(new Error(`设置存储桶ACL失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

// 设置所有文件为公共读
function setFilesACL() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?acl`;
        
        const headers = {
            'Content-Type': 'application/xml',
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`,
            'x-oss-acl': 'public-read'
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/?acl',
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
                    reject(new Error(`设置文件ACL失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

// 主函数
async function main() {
    try {
        log('🔧 开始修复OSS存储桶权限...', 'blue');
        log('=====================================', 'blue');
        
        // 检查配置
        if (!config.accessKeyId || !config.accessKeySecret) {
            log('❌ 请设置阿里云AccessKey信息', 'red');
            process.exit(1);
        }
        
        log('✅ 配置检查通过', 'green');
        log(`存储桶: ${config.bucketName}`, 'blue');
        log(`区域: ${config.region}`, 'blue');
        
        // 设置存储桶ACL
        log('🔐 设置存储桶为公共读权限...', 'blue');
        try {
            await setBucketACL();
            log('✅ 存储桶ACL设置完成', 'green');
        } catch (error) {
            log(`⚠️  存储桶ACL设置失败: ${error.message}`, 'yellow');
        }
        
        log('🎉 权限修复完成！', 'green');
        log('=====================================', 'blue');
        log('📱 现在可以尝试访问:', 'blue');
        log(`http://${config.bucketName}.${config.region}.aliyuncs.com`, 'green');
        log('', 'reset');
        log('💡 如果仍然无法访问，请手动在阿里云控制台设置:', 'yellow');
        log('1. 登录阿里云控制台 → OSS', 'yellow');
        log('2. 选择存储桶 → 权限管理', 'yellow');
        log('3. 设置读写权限为"公共读"', 'yellow');
        log('4. 设置文件权限为"公共读"', 'yellow');
        
    } catch (error) {
        log(`❌ 权限修复失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

// 运行主函数
main();
