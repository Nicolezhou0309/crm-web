import { createClient } from 'aliyun-oss';
import fs from 'fs';
import path from 'path';

// 环境变量
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET;
const BUCKET_NAME = process.env.BUCKET_NAME || 'vlinker-crm';
const REGION = process.env.REGION || 'oss-cn-shanghai';

// 创建OSS客户端
const client = createClient({
  region: REGION,
  accessKeyId: ACCESS_KEY_ID,
  accessKeySecret: ACCESS_KEY_SECRET,
  bucket: BUCKET_NAME,
});

// 文件类型映射
const contentTypeMap = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function fixFileDownloadIssue() {
  console.log('🔧 开始修复文件下载问题...');
  console.log('=====================================');

  try {
    // 获取文件列表
    console.log('📁 获取文件列表...');
    const result = await client.listObject();
    const files = result.objects || [];

    if (files.length === 0) {
      console.log('❌ 没有找到文件');
      return;
    }

    console.log(`✅ 找到 ${files.length} 个文件`);

    // 修复每个文件的Content-Type和下载属性
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const fileName = file.name;
        const ext = path.extname(fileName).toLowerCase();
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        console.log(`🔧 修复文件: ${fileName} (${contentType})`);

        // 获取文件内容
        const fileContent = await client.get(fileName);
        
        // 重新上传文件，设置正确的Content-Type和移除下载属性
        await client.put(fileName, fileContent.content, {
          contentType: contentType,
          headers: {
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': 'inline', // 移除下载属性
          }
        });

        successCount++;
        console.log(`✅ ${fileName} 修复成功`);
      } catch (error) {
        errorCount++;
        console.log(`❌ ${file.name} 修复失败: ${error.message}`);
      }
    }

    console.log('=====================================');
    console.log(`🎉 修复完成！`);
    console.log(`✅ 成功: ${successCount} 个文件`);
    console.log(`❌ 失败: ${errorCount} 个文件`);

    // 测试网站访问
    console.log('\n🧪 测试网站访问...');
    const testResponse = await fetch(`http://${BUCKET_NAME}.${REGION}.aliyuncs.com/index.html`);
    if (testResponse.ok) {
      console.log('✅ 网站访问正常');
    } else {
      console.log(`❌ 网站访问失败: ${testResponse.status}`);
    }

  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error.message);
  }
}

// 运行修复
fixFileDownloadIssue();
