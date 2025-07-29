// 测试登录保护功能
console.log('�� 测试登录保护功能...');

// 模拟登录失败
function simulateLoginFailure(email) {
  const attempts = JSON.parse(localStorage.getItem(`login_attempts_${email}`) || '{"count": 0, "blockedUntil": null}');
  attempts.count += 1;
  
  if (attempts.count >= 5) {
    attempts.blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    console.log('�� 账户已被锁定15分钟');
  }
  
  localStorage.setItem(`login_attempts_${email}`, JSON.stringify(attempts));
  console.log(`❌ 登录失败，当前失败次数: ${attempts.count}`);
}

// 检查锁定状态
function checkBlockStatus(email) {
  const attempts = JSON.parse(localStorage.getItem(`login_attempts_${email}`) || '{"count": 0, "blockedUntil": null}');
  
  if (attempts.blockedUntil && new Date() < new Date(attempts.blockedUntil)) {
    const remainingTime = Math.ceil((new Date(attempts.blockedUntil).getTime() - Date.now()) / 1000 / 60);
    console.log(`🔒 账户被锁定，剩余时间: ${remainingTime}分钟`);
    return true;
  }
  
  console.log('✅ 账户未被锁定');
  return false;
}

// 清除测试数据
function clearTestData(email) {
  localStorage.removeItem(`login_attempts_${email}`);
  console.log('🧹 已清除测试数据');
}

// 运行测试
const testEmail = 'test@example.com';

console.log('\n=== 测试开始 ===');
console.log('1. 初始状态检查');
checkBlockStatus(testEmail);

console.log('\n2. 模拟5次登录失败');
for (let i = 0; i < 5; i++) {
  simulateLoginFailure(testEmail);
}

console.log('\n3. 检查锁定状态');
checkBlockStatus(testEmail);

console.log('\n4. 清除测试数据');
clearTestData(testEmail);

console.log('\n=== 测试完成 ==='); 