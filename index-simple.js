const express = require('express');
const path = require('path');

const app = express();

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 环境变量配置
const config = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE',
  VITE_APP_ENV: process.env.VITE_APP_ENV || 'production',
  VITE_APP_VERSION: process.env.VITE_APP_VERSION || '1.0.0'
};

// 配置API端点
app.get('/api/config', (req, res) => {
  res.json({
    VITE_SUPABASE_URL: config.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: config.VITE_SUPABASE_ANON_KEY,
    VITE_APP_ENV: config.VITE_APP_ENV,
    VITE_APP_VERSION: config.VITE_APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.VITE_APP_ENV,
    version: config.VITE_APP_VERSION
  });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA路由支持
app.get('*', (req, res) => {
  // 如果是API请求，返回404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.path
    });
  }
  
  // 其他请求返回index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 函数计算入口
module.exports.handler = (event, context, callback) => {
  console.log('Function invoked:', {
    requestId: context.requestId,
    functionName: context.function.name,
    event: JSON.stringify(event, null, 2)
  });

  // 处理HTTP事件
  if (event.httpMethod) {
    // 创建模拟的请求和响应对象
    const req = {
      method: event.httpMethod,
      url: event.path || '/',
      headers: event.headers || {},
      body: event.body || '',
      query: event.queryParameters || {}
    };
    
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader: function(name, value) {
        this.headers[name] = value;
      },
      writeHead: function(statusCode, headers) {
        this.statusCode = statusCode;
        if (headers) {
          Object.assign(this.headers, headers);
        }
      },
      write: function(data) {
        this.body += data;
      },
      end: function(data) {
        if (data) {
          this.body += data;
        }
        
        // 返回响应
        const response = {
          statusCode: this.statusCode,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            ...this.headers
          },
          body: this.body
        };
        
        callback(null, response);
      }
    };
    
    // 处理请求
    try {
      app(req, res);
    } catch (error) {
      console.error('Request processing error:', error);
      callback(error);
    }
  } else {
    // 其他类型的事件
    callback(null, { 
      message: 'Function executed successfully',
      timestamp: new Date().toISOString()
    });
  }
};

// 本地开发服务器
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}
