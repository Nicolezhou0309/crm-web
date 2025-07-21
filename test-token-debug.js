// 测试token解码
const testToken = "eyJlbWFpbCI6Inpob3VsaW5neGluMDMwOUBnbWFpbC5jb20iLCJvcmdhbml6YXRpb25faWQiOiI2YWZlNzk3Zi0wYTNkLTQzMjEtODZhMS1kMDc4MjgzYzNhNjEiLCJvcmdhbml6YXRpb25fbmFtZSI6IuW+rumihuWcsOmdkuW5tOekvuWMuiIsImV4cGlyZXNfYXQiOiIyMDI1LTA3LTI4VDAxOjQ1OjUxLjM4MVoifQ==";

console.log('🔍 测试token解码...');
console.log('Token长度:', testToken.length);
console.log('Token前20字符:', testToken.substring(0, 20));

// 方法1: 直接atob
try {
  const decoded1 = atob(testToken);
  console.log('✅ 方法1成功 - 直接atob');
  console.log('解码结果:', decoded1);
  
  const json1 = JSON.parse(decoded1);
  console.log('✅ JSON解析成功:', json1);
} catch (error) {
  console.log('❌ 方法1失败:', error.message);
}

// 方法2: URL解码后再atob
try {
  const urlDecoded = decodeURIComponent(testToken);
  const decoded2 = atob(urlDecoded);
  console.log('✅ 方法2成功 - URL解码后atob');
  console.log('解码结果:', decoded2);
  
  const json2 = JSON.parse(decoded2);
  console.log('✅ JSON解析成功:', json2);
} catch (error) {
  console.log('❌ 方法2失败:', error.message);
}

// 方法3: 检查是否包含URL编码字符
console.log('🔍 检查token中的特殊字符...');
for (let i = 0; i < testToken.length; i++) {
  const char = testToken[i];
  if (char === '%' || char === '+' || char === '/') {
    console.log(`位置${i}: "${char}" (${char.charCodeAt(0)})`);
  }
}

// 方法4: 尝试不同的解码方式
try {
  // 先尝试URL解码
  let processedToken = testToken;
  if (testToken.includes('%')) {
    processedToken = decodeURIComponent(testToken);
    console.log('🔍 检测到URL编码字符，进行URL解码');
  }
  
  const decoded3 = atob(processedToken);
  console.log('✅ 方法3成功 - 智能解码');
  console.log('解码结果:', decoded3);
  
  const json3 = JSON.parse(decoded3);
  console.log('✅ JSON解析成功:', json3);
} catch (error) {
  console.log('❌ 方法3失败:', error.message);
} 