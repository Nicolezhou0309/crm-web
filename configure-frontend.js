#!/usr/bin/env node

/**
 * 配置OSS为前端网站
 * 设置存储桶权限、静态网站托管等
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';

// 配置信息
const config = {
    accessKeyId: process.env.ACCESS_KEY_ID,
    accessKeySecret: process.env.ACCESS_KEY_SECRET,
    bucketName: process.env.BUCKET_NAME || 'vlinker-crm',
    region: process.env.REGION || 'oss-cn-shanghai',
    endpoint: process.env.ENDPOINT || `https://${process.env.BUCKET_NAME || 'vlinker-crm'}.${process.env.REGION || 'oss-cn-shanghai'}.aliyuncs.com`
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

// 发送HTTP请求
function sendRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const date = new Date().toUTCString();
        const resource = `/${config.bucketName}${path}`;
        
        const defaultHeaders = {
            'Date': date,
            'Host': `${config.bucketName}.${config.region}.aliyuncs.com`
        };
        
        const finalHeaders = { ...defaultHeaders, ...headers };
        
        if (body) {
            finalHeaders['Content-Length'] = Buffer.byteLength(body).toString();
        }
        
        const signature = generateSignature(method, resource, finalHeaders, date);
        finalHeaders['Authorization'] = `OSS ${config.accessKeyId}:${signature}`;
        
        const options = {
            hostname: `${config.bucketName}.${config.region}.aliyuncs.com`,
            port: 443,
            path: path,
            method: method,
            headers: finalHeaders
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

// 1. 设置存储桶ACL为公共读
async function setBucketACL() {
    log('🔐 设置存储桶访问权限为公共读...', 'blue');
    
    try {
        const response = await sendRequest('PUT', '/?acl', {
            'x-oss-acl': 'public-read'
        });
        
        if (response.statusCode === 200) {
            log('✅ 存储桶权限设置成功', 'green');
        } else {
            log(`⚠️  存储桶权限设置失败: ${response.statusCode}`, 'yellow');
        }
    } catch (error) {
        log(`❌ 设置存储桶权限失败: ${error.message}`, 'red');
    }
}

// 2. 设置静态网站托管
async function setWebsiteHosting() {
    log('🌐 配置静态网站托管...', 'blue');
    
    const websiteConfig = `<?xml version="1.0" encoding="UTF-8"?>
<WebsiteConfiguration>
    <IndexDocument>
        <Suffix>index.html</Suffix>
    </IndexDocument>
    <ErrorDocument>
        <Key>index.html</Key>
    </ErrorDocument>
</WebsiteConfiguration>`;
    
    try {
        const response = await sendRequest('PUT', '/?website', {
            'Content-Type': 'application/xml'
        }, websiteConfig);
        
        if (response.statusCode === 200) {
            log('✅ 静态网站托管配置成功', 'green');
        } else {
            log(`⚠️  静态网站托管配置失败: ${response.statusCode}`, 'yellow');
        }
    } catch (error) {
        log(`❌ 配置静态网站托管失败: ${error.message}`, 'red');
    }
}

// 3. 设置文件ACL为公共读
async function setFilesACL() {
    log('📁 设置文件访问权限为公共读...', 'blue');
    
    try {
        // 获取文件列表
        const listResponse = await sendRequest('GET', '/?list-type=2');
        
        if (listResponse.statusCode !== 200) {
            log(`❌ 获取文件列表失败: ${listResponse.statusCode}`, 'red');
            return;
        }
        
        // 解析XML获取文件列表
        const xml = listResponse.body;
        const keyRegex = /<Key>(.*?)<\/Key>/g;
        const files = [];
        let match;
        
        while ((match = keyRegex.exec(xml)) !== null) {
            files.push(match[1]);
        }
        
        log(`📋 找到 ${files.length} 个文件需要设置权限`, 'blue');
        
        // 为每个文件设置公共读权限
        let successCount = 0;
        for (const file of files) {
            try {
                const response = await sendRequest('PUT', `/${file}?acl`, {
                    'x-oss-object-acl': 'public-read'
                });
                
                if (response.statusCode === 200) {
                    successCount++;
                    log(`✅ ${file}`, 'green');
                } else {
                    log(`❌ ${file}: ${response.statusCode}`, 'red');
                }
            } catch (error) {
                log(`❌ ${file}: ${error.message}`, 'red');
            }
        }
        
        log(`📊 权限设置完成: 成功 ${successCount}/${files.length} 个文件`, 'blue');
        
    } catch (error) {
        log(`❌ 设置文件权限失败: ${error.message}`, 'red');
    }
}

// 4. 测试访问
async function testAccess() {
    log('🧪 测试网站访问...', 'blue');
    
    try {
        const response = await sendRequest('GET', '/index.html');
        
        if (response.statusCode === 200) {
            log('✅ 网站访问正常', 'green');
        } else {
            log(`⚠️  网站访问异常: ${response.statusCode}`, 'yellow');
        }
    } catch (error) {
        log(`❌ 测试访问失败: ${error.message}`, 'red');
    }
}

// 主函数
async function main() {
    try {
        log('🚀 开始配置OSS为前端网站...', 'blue');
        log('=====================================', 'blue');
        
        // 1. 设置存储桶权限
        await setBucketACL();
        
        // 2. 配置静态网站托管
        await setWebsiteHosting();
        
        // 3. 设置文件权限
        await setFilesACL();
        
        // 4. 测试访问
        await testAccess();
        
        log('🎉 前端网站配置完成！', 'green');
        log('=====================================', 'blue');
        log('📱 访问信息:', 'blue');
        log(`网站地址: http://${config.bucketName}.${config.region}.aliyuncs.com`, 'green');
        log(`存储桶: ${config.bucketName}`, 'blue');
        log(`区域: ${config.region}`, 'blue');
        log('', 'reset');
        log('🔧 后续优化建议:', 'yellow');
        log('1. 绑定自定义域名', 'yellow');
        log('2. 配置CDN加速', 'yellow');
        log('3. 设置HTTPS证书', 'yellow');
        
    } catch (error) {
        log(`❌ 配置失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

// 运行主函数
main();
