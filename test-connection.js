// 测试连接脚本
console.log('🧪 测试HTTPS混合内容连接...');

// 测试1: 直接HTTP连接（应该失败）
console.log('测试1: 直接HTTP连接');
fetch('http://172.29.115.115:8000/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(response => {
  console.log('❌ 意外成功:', response);
})
.catch(error => {
  console.log('✅ 预期失败 (混合内容被阻止):', error.message);
});

// 测试2: 通过代理的HTTPS连接（应该成功）
console.log('测试2: 通过代理的HTTPS连接');
fetch('https://lead.vld.com.cn/supabase/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(response => {
  console.log('✅ 代理连接成功:', response.status);
})
.catch(error => {
  console.log('❌ 代理连接失败:', error.message);
});

// 测试3: WebSocket连接
console.log('测试3: WebSocket连接');
const ws = new WebSocket('wss://lead.vld.com.cn/supabase/realtime/v1/websocket');
ws.onopen = () => console.log('✅ WebSocket连接成功');
ws.onerror = (error) => console.log('❌ WebSocket连接失败:', error);
