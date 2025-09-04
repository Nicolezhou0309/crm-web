/**
 * 代理服务器支持测试脚本
 * 测试代理服务器是否支持WebSocket和HTTP请求
 */

// 测试配置
const PROXY_URL = 'https://lead-service.vld.com.cn';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

console.log('🔧 代理服务器WebSocket支持测试');
console.log('=====================================');
console.log(`代理服务器: ${PROXY_URL}`);
console.log('');

// 测试HTTP连接
async function testHttpConnection() {
  console.log('🔄 测试HTTP连接...');
  
  try {
    const response = await fetch(`${PROXY_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ HTTP连接成功！');
      console.log(`   状态码: ${response.status}`);
      console.log(`   内容类型: ${response.headers.get('content-type')}`);
      return true;
    } else {
      console.log(`❌ HTTP连接失败: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ HTTP连接异常: ${error.message}`);
    return false;
  }
}

// 测试WebSocket连接（使用Node.js内置的WebSocket）
async function testWebSocketConnection() {
  console.log('🔄 测试WebSocket连接...');
  
  const wsUrl = `${PROXY_URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
  console.log(`   WebSocket URL: ${wsUrl}`);
  
  try {
    // 动态导入ws模块
    const { default: WebSocket } = await import('ws');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.log('⏰ WebSocket连接超时 (10秒)');
        console.log('❌ 代理服务器可能不支持WebSocket或配置有问题');
        resolve(false);
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
          console.log('🔌 WebSocket连接正常关闭');
          resolve(true);
        }, 2000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📥 收到服务器响应:', JSON.stringify(message, null, 2));
        } catch (error) {
          console.log('📥 收到原始响应:', data.toString());
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log('❌ WebSocket连接失败:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
          console.log('   原因: 连接被拒绝 - 代理服务器可能不支持WebSocket');
        } else if (error.message.includes('ENOTFOUND')) {
          console.log('   原因: 域名解析失败 - 请检查代理服务器地址');
        } else if (error.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
          console.log('   原因: SSL证书验证失败 - 代理服务器SSL配置问题');
        } else {
          console.log('   原因: 代理服务器可能不支持WebSocket');
        }
        
        resolve(false);
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
    
  } catch (error) {
    console.log(`❌ WebSocket测试失败: ${error.message}`);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试代理服务器支持情况...\n');
  
  // 测试HTTP连接
  const httpSuccess = await testHttpConnection();
  console.log('');
  
  if (!httpSuccess) {
    console.log('❌ HTTP连接失败，跳过WebSocket测试');
    console.log('\n💡 建议解决方案:');
    console.log('   1. 检查代理服务器地址是否正确');
    console.log('   2. 确认代理服务器是否正常运行');
    console.log('   3. 检查网络连接');
    return;
  }
  
  // 测试WebSocket连接
  const wsSuccess = await testWebSocketConnection();
  console.log('');
  
  // 总结结果
  console.log('📊 测试结果总结:');
  console.log('=====================================');
  console.log(`HTTP支持: ${httpSuccess ? '✅ 支持' : '❌ 不支持'}`);
  console.log(`WebSocket支持: ${wsSuccess ? '✅ 支持' : '❌ 不支持'}`);
  
  if (wsSuccess) {
    console.log('\n🎉 结论: 代理服务器完全支持Supabase Realtime功能！');
    console.log('   您可以启用realtime功能，享受实时数据同步。');
  } else {
    console.log('\n⚠️  结论: 代理服务器不支持WebSocket连接。');
    console.log('   建议继续使用轮询方式，或联系代理服务器管理员配置WebSocket支持。');
    console.log('\n💡 代理服务器WebSocket配置建议:');
    console.log('   1. 确保代理服务器支持WebSocket升级');
    console.log('   2. 配置正确的WebSocket转发规则');
    console.log('   3. 检查SSL证书配置');
    console.log('   4. 确认防火墙允许WebSocket连接');
  }
}

// 运行测试
runTests().catch(console.error);
