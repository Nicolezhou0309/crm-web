import { createClient } from 'aliyun-oss';

// 环境变量
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET;
const BUCKET_NAME = process.env.BUCKET_NAME || 'vlinker-crm';
const REGION = process.env.REGION || 'oss-cn-shanghai';

console.log('🔍 测试OSS API...');
console.log('=====================================');

try {
  // 创建OSS客户端
  console.log('📡 创建OSS客户端...');
  const client = createClient({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET_NAME,
  });

  console.log('✅ 客户端创建成功');
  console.log('🔧 客户端方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)).slice(0, 20));

  // 测试listObject
  console.log('\n📁 测试listObject...');
  const result = await client.listObject();
  console.log('📊 listObject结果类型:', typeof result);
  console.log('📊 listObject结果:', result);
  
  if (result && typeof result === 'object') {
    console.log('📊 结果键:', Object.keys(result));
  }

} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('�� 错误详情:', error);
}
