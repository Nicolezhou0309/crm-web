// 简单测试函数计算入口
const handler = require('./index.js').handler;

console.log('🧪 开始简单测试函数计算入口...');

// 模拟事件和上下文
const mockEvent = {
  httpMethod: 'GET',
  path: '/api/health',
  headers: {
    'User-Agent': 'Test-Agent'
  },
  queryParameters: {},
  body: null
};

const mockContext = {
  requestId: 'test-request-id',
  function: {
    name: 'crm-frontend-app-test',
    version: '1.0.0'
  }
};

// 测试函数
async function testFunction() {
  try {
    console.log('\n1. 测试健康检查端点...');
    
    const result = await new Promise((resolve, reject) => {
      handler(mockEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 健康检查测试通过');
    console.log('状态码:', result.statusCode);
    console.log('响应头:', result.headers);
    
    if (result.body) {
      try {
        const bodyData = JSON.parse(result.body);
        console.log('响应数据:', bodyData);
      } catch (e) {
        console.log('响应内容长度:', result.body.length);
      }
    }
    
    console.log('\n🎉 测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testFunction();
