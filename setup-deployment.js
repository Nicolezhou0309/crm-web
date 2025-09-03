#!/usr/bin/env node

/**
 * 部署配置脚本
 * 帮助用户设置阿里云OSS部署参数
 */

import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupDeployment() {
    console.log('🚀 阿里云OSS部署配置向导');
    console.log('=====================================');
    console.log('');
    
    console.log('📋 请提供以下信息：');
    console.log('');
    
    // 获取AccessKey ID
    const accessKeyId = await question('1. 阿里云AccessKey ID: ');
    if (!accessKeyId.trim()) {
        console.log('❌ AccessKey ID不能为空');
        process.exit(1);
    }
    
    // 获取AccessKey Secret
    const accessKeySecret = await question('2. 阿里云AccessKey Secret: ');
    if (!accessKeySecret.trim()) {
        console.log('❌ AccessKey Secret不能为空');
        process.exit(1);
    }
    
    // 获取存储桶名称
    const bucketName = await question('3. OSS存储桶名称 (默认: crm-web-frontend): ') || 'crm-web-frontend';
    
    // 获取区域
    const region = await question('4. OSS区域 (默认: oss-cn-shanghai): ') || 'oss-cn-shanghai';
    
    console.log('');
    console.log('📝 配置信息确认:');
    console.log(`AccessKey ID: ${accessKeyId}`);
    console.log(`AccessKey Secret: ${'*'.repeat(accessKeySecret.length)}`);
    console.log(`存储桶名称: ${bucketName}`);
    console.log(`区域: ${region}`);
    console.log('');
    
    const confirm = await question('确认配置信息？(y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        console.log('❌ 配置已取消');
        process.exit(0);
    }
    
    // 创建环境变量文件
    const envContent = `# 阿里云OSS部署配置
ACCESS_KEY_ID=${accessKeyId}
ACCESS_KEY_SECRET=${accessKeySecret}
BUCKET_NAME=${bucketName}
REGION=${region}
ENDPOINT=https://${bucketName}.${region}.aliyuncs.com
`;
    
    fs.writeFileSync('.env.deployment', envContent);
    console.log('✅ 配置已保存到 .env.deployment 文件');
    
    // 创建部署脚本
    const deployScript = `#!/bin/bash

# 加载环境变量
source .env.deployment

# 运行部署脚本
node deploy-with-api.js
`;
    
    fs.writeFileSync('deploy.sh', deployScript);
    fs.chmodSync('deploy.sh', '755');
    console.log('✅ 部署脚本已创建: deploy.sh');
    
    console.log('');
    console.log('🎉 配置完成！');
    console.log('');
    console.log('📋 下一步操作:');
    console.log('1. 运行部署: ./deploy.sh');
    console.log('2. 或者直接运行: node deploy-with-api.js');
    console.log('');
    console.log('⚠️  注意事项:');
    console.log('- 请确保AccessKey有OSS访问权限');
    console.log('- 存储桶名称必须全局唯一');
    console.log('- 建议使用HTTPS访问地址');
    
    rl.close();
}

setupDeployment().catch(console.error);
