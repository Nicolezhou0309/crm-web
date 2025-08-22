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
    process.exit(1);
  }
  
  console.log('📋 配置信息:');
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 匿名密钥: ${anonKey.substring(0, 50)}...`);
  console.log('');
  
  console.log('🧪 测试不同的认证端点...');
  console.log('');
  
  // 测试各种可能的认证端点
  const authEndpoints = [
    { path: '/auth/v1/signup', method: 'POST', description: '标准注册端点' },
    { path: '/auth/v1/signin', method: 'POST', description: '标准登录端点' },
    { path: '/auth/v1/token', method: 'POST', description: '标准令牌端点' },
    { path: '/auth/v1/user', method: 'GET', description: '用户信息端点' },
    { path: '/auth/v1/logout', method: 'POST', description: '登出端点' },
    { path: '/rest/v1/', method: 'GET', description: 'REST API根端点' },
    { path: '/rest/v1/users', method: 'GET', description: '用户表端点' },
    { path: '/rest/v1/users_profile', method: 'GET', description: '用户档案表端点' }
  ];
  
  console.log('📋 测试端点列表:');
  authEndpoints.forEach((endpoint, index) => {
    console.log(`${index + 1}. ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
  });
  
  console.log('\n🔍 测试命令:');
  console.log('');
  
  // 生成测试命令
  authEndpoints.forEach((endpoint, index) => {
    console.log(`# ${index + 1}. 测试 ${endpoint.description}`);
    if (endpoint.method === 'GET') {
      console.log(`curl -X GET '${supabaseUrl}${endpoint.path}' \\`);
      console.log(`  -H "apikey: ${anonKey}"`);
    } else {
      console.log(`curl -X POST '${supabaseUrl}${endpoint.path}' \\`);
      console.log(`  -H "apikey: ${anonKey}" \\`);
      console.log(`  -H "Content-Type: application/json"`);
      if (endpoint.path.includes('signup')) {
        console.log(`  -d '{"email":"test@example.com","password":"Test123456"}'`);
      } else if (endpoint.path.includes('signin') || endpoint.path.includes('token')) {
        console.log(`  -d '{"username":"test@example.com","password":"Test123456"}'`);
      }
    }
    console.log('');
  });
  
  console.log('💡 诊断建议:');
  console.log('1. 运行上述测试命令检查哪些端点可用');
  console.log('2. 如果所有认证端点都不可用，说明阿里云Supabase未启用认证服务');
  console.log('3. 如果REST端点可用，可以考虑使用数据库直接操作的方式');
  console.log('4. 联系阿里云技术支持启用认证服务');
  
} catch (error) {
  console.error('❌ 检查失败:', error.message);
}
