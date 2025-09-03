#!/usr/bin/env node

/**
 * 设置OSS文件为公共读权限
 * 使用阿里云OSS API
 */

import crypto from 'crypto';
import https from 'https';

const config = {
    accessKeyId: process.env.ACCESS_KEY_ID,
    accessKeySecret: process.env.ACCESS_KEY_SECRET,
    bucketName: process.env.BUCKET_NAME || 'vlinker-crm',
    region: process.env.REGION || 'oss-cn-shanghai'
};

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
    
    return crypto
        .createHmac('sha1', config.accessKeySecret)
        .update(stringToSign)
        .digest('base64');
}

// 设置存储桶ACL
function setBucketACL() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?acl`;
        
        const headers = {
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
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    reject(new Error(`设置存储桶ACL失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 获取文件列表
function listFiles() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/`;
        
        const headers = {
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const signature = generateSignature('GET', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/',
            method: 'GET',
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`获取文件列表失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 设置单个文件ACL
function setFileACL(objectKey) {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/${objectKey}?acl`;
        
        const headers = {
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`,
            'x-oss-acl': 'public-read'
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: `/${objectKey}?acl`,
            method: 'PUT',
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    reject(new Error(`设置文件ACL失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 主函数
async function main() {
    try {
        log('🔧 开始设置OSS文件为公共读权限...', 'blue');
        log('=====================================', 'blue');
        
        // 1. 设置存储桶ACL
        log('📦 设置存储桶为公共读...', 'blue');
        try {
            await setBucketACL();
            log('✅ 存储桶ACL设置完成', 'green');
        } catch (error) {
            log(`⚠️  存储桶ACL设置失败: ${error.message}`, 'yellow');
        }
        
        // 2. 获取文件列表
        log('📁 获取文件列表...', 'blue');
        try {
            const xmlData = await listFiles();
            // 简单解析XML获取文件列表
            const files = [];
            const regex = /<Key>(.*?)<\/Key>/g;
            let match;
            while ((match = regex.exec(xmlData)) !== null) {
                files.push(match[1]);
            }
            
            log(`✅ 找到 ${files.length} 个文件`, 'green');
            
            // 3. 批量设置文件ACL
            if (files.length > 0) {
                log('🔐 批量设置文件权限...', 'blue');
                let successCount = 0;
                let failCount = 0;
                
                for (const file of files) {
                    try {
                        await setFileACL(file);
                        log(`✅ ${file}`, 'green');
                        successCount++;
                    } catch (error) {
                        log(`❌ ${file}: ${error.message}`, 'red');
                        failCount++;
                    }
                }
                
                log(`📊 文件权限设置完成: 成功 ${successCount} 个，失败 ${failCount} 个`, 'blue');
            }
            
        } catch (error) {
            log(`⚠️  获取文件列表失败: ${error.message}`, 'yellow');
        }
        
        log('🎉 权限设置完成！', 'green');
        log('=====================================', 'blue');
        log('📱 现在可以访问:', 'blue');
        log(`http://${config.bucketName}.${config.region}.aliyuncs.com`, 'green');
        
    } catch (error) {
        log(`❌ 权限设置失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();
