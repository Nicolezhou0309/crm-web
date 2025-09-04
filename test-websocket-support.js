/**
 * WebSocket支持测试脚本
 * 用于测试代理服务器是否支持Supabase Realtime WebSocket连接
 */

import WebSocket from 'ws';

// 测试配置
const PROXY_URL = 'https://lead-service.vld.com.cn';
const SUPABASE_URL = 'https://lead-service.vld.com.cn'; // 通过代理访问
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

// 构建WebSocket URL
const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

console.log('🔧 WebSocket测试配置:');
console.log('  代理服务器:', PROXY_URL);
console.log('  WebSocket URL:', wsUrl);
console.log('');

// 测试WebSocket连接
function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('🔄 开始测试WebSocket连接...');
    
    const ws = new WebSocket(wsUrl);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('连接超时 (10秒)'));
    }, 10000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket连接成功！');
      console.log('   - 代理服务器支持WebSocket');
      console.log('   - Supabase Realtime功能可用');
      
      // 发送测试消息
      const testMessage = {
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: '1'
      };
      
      ws.send(JSON.stringify(testMessage));
      console.log('📤 发送心跳测试消息');
      
      setTimeout(() => {
        ws.close();
        resolve({
          success: true,
          message: 'WebSocket连接成功，支持Realtime功能'
        });
      }, 2000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 收到服务器响应:', message);
      } catch (error) {
        console.log('📥 收到原始响应:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket连接失败:', error.message);
      
      if (error.message.includes('ECONNREFUSED')) {
        reject({
          success: false,
          message: '连接被拒绝 - 代理服务器可能不支持WebSocket',
          error: error.message
        });
      } else if (error.message.includes('ENOTFOUND')) {
        reject({
          success: false,
          message: '域名解析失败 - 请检查代理服务器地址',
          error: error.message
        });
      } else if (error.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
        reject({
          success: false,
          message: 'SSL证书验证失败 - 代理服务器SSL配置问题',
          error: error.message
        });
      } else {
        reject({
          success: false,
          message: 'WebSocket连接失败 - 代理服务器可能不支持WebSocket',
          error: error.message
        });
      }
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (code === 1000) {
        console.log('🔌 WebSocket连接正常关闭');
      } else {
        console.log(`🔌 WebSocket连接关闭: ${code} - ${reason}`);
      }
    });
  });
}

// 测试HTTP连接
async function testHttpConnection() {
  try {
    console.log('🔄 测试HTTP连接...');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ HTTP连接成功！');
      console.log('   - 代理服务器支持HTTP请求');
      return true;
    } else {
      console.log('❌ HTTP连接失败:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ HTTP连接异常:', error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试代理服务器支持情况...\n');
  
  try {
    // 测试HTTP连接
    const httpSuccess = await testHttpConnection();
    console.log('');
    
    if (!httpSuccess) {
      console.log('❌ HTTP连接失败，跳过WebSocket测试');
      return;
    }
    
    // 测试WebSocket连接
    const wsResult = await testWebSocketConnection();
    console.log('\n🎉 测试结果:', wsResult.message);
    
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message);
    
    if (error.error) {
      console.log('   错误详情:', error.error);
    }
    
    console.log('\n💡 建议解决方案:');
    console.log('   1. 检查代理服务器是否支持WebSocket升级');
    console.log('   2. 确认代理服务器配置了正确的WebSocket转发规则');
    console.log('   3. 检查SSL证书配置是否正确');
    console.log('   4. 联系代理服务器管理员确认WebSocket支持');
  }
}

// 运行测试
runTests().catch(console.error);
