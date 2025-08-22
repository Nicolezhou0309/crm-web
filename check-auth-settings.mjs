import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 检查阿里云Supabase认证设置...\n');

// 阿里云Supabase配置
const ALIYUN_BASE_URL = 'http://8.159.21.226:8000';
const SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwicmVmIjoic2JwLThvaDE4bTAzaGJiMDg3dGEiLCJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1NTQyMjgyMSwiZXhwIjoyMDcwOTk4ODIxfQ.8Ko-wygiJIRaQ9RD71e_YCFLKOKLg1czr-TDl7nHJXg';

console.log('📋 阿里云Supabase配置:');
console.log(`📍 基础URL: ${ALIYUN_BASE_URL}`);
console.log(`🔑 服务角色密钥: ${SERVICE_ROLE_KEY.substring(0, 50)}...`);
console.log('');

console.log('🧪 检查认证设置...');
console.log('');

// 检查认证设置
console.log('🔍 1. 检查认证设置:');
console.log(`curl -X GET '${ALIYUN_BASE_URL}/auth/v1/settings' \\`);
console.log(`  -H "apikey: ${SERVICE_ROLE_KEY}"`);
console.log('');

// 检查用户列表
console.log('🔍 2. 检查用户列表:');
console.log(`curl -X GET '${ALIYUN_BASE_URL}/auth/v1/admin/users' \\`);
console.log(`  -H "apikey: ${SERVICE_ROLE_KEY}"`);
console.log('');

// 检查特定用户状态
console.log('🔍 3. 检查特定用户状态:');
console.log(`curl -X GET '${ALIYUN_BASE_URL}/auth/v1/admin/users/USER_ID' \\`);
console.log(`  -H "apikey: ${SERVICE_ROLE_KEY}"`);
console.log('');

// 检查邮件配置
console.log('🔍 4. 检查邮件配置:');
console.log(`curl -X GET '${ALIYUN_BASE_URL}/auth/v1/admin/settings' \\`);
console.log(`  -H "apikey: ${SERVICE_ROLE_KEY}"`);
console.log('');

// 测试邮件发送
console.log('🔍 5. 测试邮件发送:');
console.log(`curl -X POST '${ALIYUN_BASE_URL}/auth/v1/recover' \\`);
console.log(`  -H "apikey: ${SERVICE_ROLE_KEY}" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"email":"test@example.com"}'`);
console.log('');

console.log('💡 诊断说明:');
console.log('');
console.log('📧 邮件验证问题诊断:');
console.log('1. 如果设置中 mailer_autoconfirm=true，用户注册后直接通过');
console.log('2. 如果 require_email_confirmation=false，不需要邮件验证');
console.log('3. 如果SMTP未配置，邮件发送会失败');
console.log('4. 如果邮件模板缺失，验证邮件无法发送');
console.log('');

console.log('🔧 解决方案:');
console.log('1. 检查认证设置中的邮件验证配置');
console.log('2. 配置SMTP服务器（如Gmail、QQ邮箱、阿里云邮件服务）');
console.log('3. 设置邮件模板和发件人信息');
console.log('4. 启用完整的邮件验证流程');
console.log('');

console.log('⚠️  重要提示:');
console.log('- 使用service_role_key进行管理操作');
console.log('- 邮件配置需要管理员权限');
console.log('- 测试邮件发送前确保SMTP已配置');
console.log('');

console.log('🚀 现在可以运行上述命令检查认证设置了！');
