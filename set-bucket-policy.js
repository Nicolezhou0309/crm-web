#!/usr/bin/env node

/**
 * 通过Bucket Policy设置OSS公共访问权限
 * 基于阿里云官方文档：https://help.aliyun.com/zh/oss/use-bucket-policy-to-grant-permission-to-access-oss/
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

// 设置Bucket Policy
function setBucketPolicy() {
    return new Promise((resolve, reject) => {
        // 根据阿里云官方文档的Bucket Policy配置
        const policy = {
            "Version": "1",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": [
                        "oss:GetObject",
                        "oss:ListObjects"
                    ],
                    "Resource": [
                        `acs:oss:*:*:${config.bucketName}/*`
                    ]
                }
            ]
        };

        const policyString = JSON.stringify(policy);
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?policy`;
        
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(policyString).toString(),
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const signature = generateSignature('PUT', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/?policy',
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
                    reject(new Error(`设置Bucket Policy失败: ${res.statusCode} ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(policyString);
        req.end();
    });
}

// 获取当前Bucket Policy
function getBucketPolicy() {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}/?policy`;
        
        const headers = {
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const signature = generateSignature('GET', resource, headers, date);
        headers['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: '/?policy',
            method: 'GET',
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else if (res.statusCode === 404) {
                    resolve(null); // 没有设置Policy
                } else {
                    reject(new Error(`获取Bucket Policy失败: ${res.statusCode} ${data}`));
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
        log('🔧 通过Bucket Policy设置OSS公共访问权限...', 'blue');
        log('=====================================', 'blue');
        log('📚 基于阿里云官方文档配置', 'yellow');
        log('https://help.aliyun.com/zh/oss/use-bucket-policy-to-grant-permission-to-access-oss/', 'yellow');
        log('=====================================', 'blue');
        
        // 检查配置
        if (!config.accessKeyId || !config.accessKeySecret) {
            log('❌ 请设置阿里云AccessKey信息', 'red');
            process.exit(1);
        }
        
        log('✅ 配置检查通过', 'green');
        log(`存储桶: ${config.bucketName}`, 'blue');
        log(`区域: ${config.region}`, 'blue');
        
        // 1. 检查当前Policy
        log('📋 检查当前Bucket Policy...', 'blue');
        try {
            const currentPolicy = await getBucketPolicy();
            if (currentPolicy) {
                log('✅ 当前已设置Bucket Policy', 'green');
                log('当前Policy内容:', 'blue');
                console.log(JSON.stringify(JSON.parse(currentPolicy), null, 2));
            } else {
                log('ℹ️  当前未设置Bucket Policy', 'yellow');
            }
        } catch (error) {
            log(`⚠️  检查Policy失败: ${error.message}`, 'yellow');
        }
        
        // 2. 设置新的Bucket Policy
        log('🔐 设置Bucket Policy为公共读访问...', 'blue');
        try {
            await setBucketPolicy();
            log('✅ Bucket Policy设置完成', 'green');
            log('', 'reset');
            log('📝 设置的Policy内容:', 'blue');
            console.log(JSON.stringify({
                "Version": "1",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": [
                            "oss:GetObject",
                            "oss:ListObjects"
                        ],
                        "Resource": [
                            `acs:oss:*:*:${config.bucketName}/*`
                        ]
                    }
                ]
            }, null, 2));
        } catch (error) {
            log(`❌ Bucket Policy设置失败: ${error.message}`, 'red');
            log('', 'reset');
            log('💡 请尝试手动在阿里云控制台设置:', 'yellow');
            log('1. 登录阿里云控制台 → OSS', 'yellow');
            log('2. 选择存储桶 → 权限控制 → Bucket 授权策略', 'yellow');
            log('3. 新增授权 → 整个Bucket → 所有账号(*) → 只读', 'yellow');
            return;
        }
        
        log('🎉 Bucket Policy配置完成！', 'green');
        log('=====================================', 'blue');
        log('📱 现在可以访问:', 'blue');
        log(`http://${config.bucketName}.${config.region}.aliyuncs.com`, 'green');
        log('', 'reset');
        log('🔍 测试访问:', 'blue');
        log(`curl -I http://${config.bucketName}.${config.region}.aliyuncs.com`, 'yellow');
        
    } catch (error) {
        log(`❌ 配置失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();
