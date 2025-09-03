const express = require('express');
const path = require('path');

// 测试函数计算入口
const handler = require('./index.js').handler;

// 模拟事件和上下文
const mockEvent = {
  httpMethod: 'GET',
  path: '/',
  headers: {
    'User-Agent': 'Test-Agent',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  },
  queryParameters: {},
  body: null
};

const mockContext = {
  requestId: 'test-request-id',
  function: {
    name: 'crm-frontend-app-test',
    version: '1.0.0'
  },
  credentials: {
    accessKeyId: 'test-access-key',
    accessKeySecret: 'test-secret-key'
  },
  region: 'cn-shanghai'
};

// 测试函数
async function testFunction() {
  console.log('🧪 开始测试函数计算入口...');
  
  try {
    // 测试健康检查端点
    console.log('\n1. 测试健康检查端点...');
    const healthEvent = {
      ...mockEvent,
      path: '/api/health',
      httpMethod: 'GET'
    };
    
    const healthResult = await new Promise((resolve, reject) => {
      handler(healthEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 健康检查测试通过');
    console.log('状态码:', healthResult.statusCode);
    console.log('响应头:', healthResult.headers);
    
    // 测试配置端点
    console.log('\n2. 测试配置端点...');
    const configEvent = {
      ...mockEvent,
      path: '/api/config',
      httpMethod: 'GET'
    };
    
    const configResult = await new Promise((resolve, reject) => {
      handler(configEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 配置端点测试通过');
    console.log('状态码:', configResult.statusCode);
    
    // 测试主页
    console.log('\n3. 测试主页...');
    const homeEvent = {
      ...mockEvent,
      path: '/',
      httpMethod: 'GET'
    };
    
    const homeResult = await new Promise((resolve, reject) => {
      handler(homeEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 主页测试通过');
    console.log('状态码:', homeResult.statusCode);
    console.log('内容类型:', homeResult.headers['Content-Type']);
    
    // 测试SPA路由
    console.log('\n4. 测试SPA路由...');
    const spaEvent = {
      ...mockEvent,
      path: '/dashboard',
      httpMethod: 'GET'
    };
    
    const spaResult = await new Promise((resolve, reject) => {
      handler(spaEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ SPA路由测试通过');
    console.log('状态码:', spaResult.statusCode);
    
    // 测试404 API端点
    console.log('\n5. 测试404 API端点...');
    const notFoundEvent = {
      ...mockEvent,
      path: '/api/nonexistent',
      httpMethod: 'GET'
    };
    
    const notFoundResult = await new Promise((resolve, reject) => {
      handler(notFoundEvent, mockContext, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log('✅ 404 API端点测试通过');
    console.log('状态码:', notFoundResult.statusCode);
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testFunction();
}

module.exports = { testFunction };
