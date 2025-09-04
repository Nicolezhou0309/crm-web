// 阿里云函数计算代理函数
// 用于解决HTTPS页面连接HTTP Supabase的混合内容问题

const http = require('http');
const https = require('https');
const url = require('url');

exports.handler = async (event, context) => {
  console.log('收到请求:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, headers, body, queryStringParameters } = event;
  
  try {
    // 构建目标URL
    const targetHost = '47.123.26.25';
    const targetPort = 8000;
    const targetPath = path || '/';
    
    // 处理查询参数
    let queryString = '';
    if (queryStringParameters) {
      const params = new URLSearchParams();
      Object.entries(queryStringParameters).forEach(([key, value]) => {
        params.append(key, value);
      });
      queryString = params.toString();
    }
    
    const fullPath = queryString ? `${targetPath}?${queryString}` : targetPath;
    
    console.log(`代理请求到: http://${targetHost}:${targetPort}${fullPath}`);
    
    // 准备请求选项
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: fullPath,
      method: httpMethod,
      headers: {
        ...headers,
        'host': `${targetHost}:${targetPort}`,
        // 移除可能导致问题的头部
        'origin': undefined,
        'referer': undefined
      },
      timeout: 30000 // 30秒超时
    };
    
    // 发送请求
    const response = await makeRequest(options, body);
    
    console.log(`响应状态: ${response.statusCode}`);
    
    return {
      statusCode: response.statusCode,
      headers: {
        ...response.headers,
        // 添加CORS头部
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
        'Access-Control-Max-Age': '86400'
      },
      body: response.body
    };
    
  } catch (error) {
    console.error('代理请求失败:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: '代理请求失败',
        message: error.message
      })
    };
  }
};

// 发送HTTP请求的辅助函数
function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    // 处理OPTIONS请求（CORS预检）
    if (options.method === 'OPTIONS') {
      req.end();
      return;
    }
    
    // 发送请求体
    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    
    req.end();
  });
}

// 处理WebSocket升级请求
exports.websocketHandler = async (event, context) => {
  console.log('WebSocket请求:', JSON.stringify(event, null, 2));
  
  // 这里需要特殊处理WebSocket升级
  // 阿里云函数计算对WebSocket的支持有限
  // 建议使用API网关的WebSocket功能
  
  return {
    statusCode: 426,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      error: 'WebSocket需要特殊配置',
      message: '请使用API网关的WebSocket功能或配置专门的WebSocket代理'
    })
  };
};
