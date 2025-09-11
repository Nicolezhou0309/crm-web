#!/usr/bin/env node

/**
 * OSS 诊断工具
 * 用于测试阿里云 OSS 连接和配置
 */

// 使用ES模块导入
import OSS from 'ali-oss';

// OSS配置（从ossUploadUtils.ts中获取）
const ossConfig = {
  region: process.env.OSS_REGION || 'cn-shanghai',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'vlinker-crm',
  endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-shanghai.aliyuncs.com',
  secure: true,
  timeout: 60000
};

async function diagnoseOSS() {
  console.log('🔍 开始OSS诊断...\n');
  
  // 检查环境变量
  console.log('📋 环境变量检查:');
  console.log(`  OSS_REGION: ${process.env.OSS_REGION || '未设置'}`);
  console.log(`  OSS_ACCESS_KEY_ID: ${process.env.OSS_ACCESS_KEY_ID ? '已设置' : '未设置'}`);
  console.log(`  OSS_ACCESS_KEY_SECRET: ${process.env.OSS_ACCESS_KEY_SECRET ? '已设置' : '未设置'}`);
  console.log(`  OSS_BUCKET: ${process.env.OSS_BUCKET || '未设置'}`);
  console.log(`  OSS_ENDPOINT: ${process.env.OSS_ENDPOINT || '未设置'}\n`);

  // 检查必需的环境变量
  const requiredVars = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:', missingVars.join(', '));
    console.log('请设置以下环境变量:');
    missingVars.forEach(varName => {
      console.log(`  export ${varName}=your_value`);
    });
    return;
  }

  try {
    // 创建OSS客户端
    console.log('🔧 创建OSS客户端...');
    const client = new OSS(ossConfig);
    console.log('✅ OSS客户端创建成功\n');

    // 测试连接
    console.log('🔗 测试OSS连接...');
    const result = await client.getBucketInfo(ossConfig.bucket);
    console.log('✅ OSS连接成功');
    console.log(`  Bucket名称: ${result.bucket.Name}`);
    console.log(`  创建时间: ${result.bucket.CreationDate}`);
    console.log(`  存储类型: ${result.bucket.StorageClass}\n`);

    // 测试上传
    console.log('📤 测试文件上传...');
    const testContent = `OSS诊断测试 - ${new Date().toISOString()}`;
    const testKey = `diagnosis/test-${Date.now()}.txt`;
    
    const uploadResult = await client.put(testKey, Buffer.from(testContent));
    console.log('✅ 文件上传成功');
    console.log(`  文件URL: ${uploadResult.url}\n`);

    // 测试下载
    console.log('📥 测试文件下载...');
    const downloadResult = await client.get(testKey);
    const downloadedContent = downloadResult.content.toString();
    console.log('✅ 文件下载成功');
    console.log(`  下载内容: ${downloadedContent}\n`);

    // 清理测试文件
    console.log('🧹 清理测试文件...');
    await client.delete(testKey);
    console.log('✅ 测试文件已清理\n');

    console.log('🎉 OSS诊断完成，所有测试通过！');

  } catch (error) {
    console.error('❌ OSS诊断失败:');
    console.error(`  错误类型: ${error.name}`);
    console.error(`  错误信息: ${error.message}`);
    
    if (error.code) {
      console.error(`  错误代码: ${error.code}`);
    }
    
    if (error.status) {
      console.error(`  HTTP状态: ${error.status}`);
    }

    // 提供解决建议
    console.log('\n💡 解决建议:');
    if (error.code === 'InvalidAccessKeyId') {
      console.log('  - 检查 AccessKeyId 是否正确');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('  - 检查 AccessKeySecret 是否正确');
    } else if (error.code === 'NoSuchBucket') {
      console.log('  - 检查 Bucket 名称是否正确');
    } else if (error.code === 'AccessDenied') {
      console.log('  - 检查 AccessKey 权限是否足够');
    } else {
      console.log('  - 检查网络连接');
      console.log('  - 检查 OSS 配置');
      console.log('  - 查看阿里云 OSS 控制台');
    }
  }
}

// 运行诊断
diagnoseOSS().catch(console.error);
