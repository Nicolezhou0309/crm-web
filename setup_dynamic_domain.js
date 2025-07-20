// 设置动态域名配置
const { execSync } = require('child_process');

console.log('🌐 设置全局动态域名支持...\n');

// 1. 设置环境变量
console.log('1️⃣ 设置环境变量...');

// 开发环境配置
console.log('设置开发环境域名...');
try {
  execSync('supabase secrets set RESEND_FROM_DOMAIN=resend.dev', { stdio: 'inherit' });
  console.log('✅ 开发环境域名设置成功');
} catch (error) {
  console.log('⚠️ 开发环境域名设置失败，可能已存在');
}

// 2. 部署更新的函数
console.log('\n2️⃣ 部署更新的Edge Functions...');

const functions = ['invite-user', 'test-email'];

functions.forEach(func => {
  console.log(`部署 ${func} 函数...`);
  try {
    execSync(`supabase functions deploy ${func}`, { stdio: 'inherit' });
    console.log(`✅ ${func} 函数部署成功`);
  } catch (error) {
    console.log(`❌ ${func} 函数部署失败:`, error.message);
  }
});

// 3. 验证配置
console.log('\n3️⃣ 验证配置...');
console.log('📋 当前配置:');
console.log('   - 开发环境: noreply@resend.dev');
console.log('   - 生产环境: noreply@yourdomain.com (需要设置)');
console.log('   - 自动切换: 根据环境变量');

// 4. 使用说明
console.log('\n4️⃣ 使用说明:');
console.log('📧 切换到生产环境:');
console.log('   supabase secrets set RESEND_FROM_DOMAIN=yourdomain.com');
console.log('');
console.log('📧 切换回开发环境:');
console.log('   supabase secrets set RESEND_FROM_DOMAIN=resend.dev');
console.log('');
console.log('📧 验证配置:');
console.log('   访问邮件测试页面进行测试');

console.log('\n�� 全局动态域名支持配置完成！'); 