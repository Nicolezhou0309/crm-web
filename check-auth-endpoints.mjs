import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 检查阿里云Supabase认证端点...\n');

try {
  // 读取环境变量
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  
  const envVars = {};
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    }
  });
  
  const supabaseUrl = envVars.VITE_SUPABASE_URL;
  const anonKey = envVars.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    console.log('❌ 环境变量配置不完整');
    return;
  }
  
  console.log('📋 配置信息:');
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 匿名密钥: ${anonKey.substring(0, 50)}...`);
  console.log('');
  
  console.log('🧪 测试认证端点...');
  console.log('');
  
  // 测试不同的认证端点
  const authEndpoints = [
    '/auth/v1/token',
    '/auth/v1/signup',
    '/auth/v1/signin',
    '/auth/v1/user',
    '/auth/v1/logout'
  ];
  
  console.log('📋 可用的认证端点测试:');
  authEndpoints.forEach(endpoint => {
    console.log(`   ${endpoint}`);
  });
  
  console.log('');
  console.log('🔍 手动测试命令:');
  console.log('');
  
  // 生成测试命令
  authEndpoints.forEach(endpoint => {
    console.log(`# 测试 ${endpoint}`);
    console.log(`curl -X POST '${supabaseUrl}${endpoint}' \\`);
    console.log(`  -H "apikey: ${anonKey}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email":"test@example.com","password":"test123"}'`);
    console.log('');
  });
  
  console.log('💡 建议:');
  console.log('1. 运行上述测试命令检查哪些端点可用');
  console.log('2. 如果所有端点都不可用，可能需要配置阿里云Supabase的认证服务');
  console.log('3. 或者使用数据库直接插入用户数据的方式');
  
} catch (error) {
  console.error('❌ 检查失败:', error.message);
}
