const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();

// 安全中间件 - 简化配置以避免函数计算兼容性问题
app.use(helmet({
  contentSecurityPolicy: false, // 禁用CSP以避免函数计算兼容性问题
  crossOriginEmbedderPolicy: false,
  hsts: false // 禁用HSTS
}));

// 压缩中间件
app.use(compression());

// 日志中间件
app.use(morgan('combined'));

// CORS配置
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Info']
}));

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 环境变量配置
const config = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE',
  VITE_SUPABASE_SERVICE_ROLE_KEY: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  VITE_APP_ENV: process.env.VITE_APP_ENV || 'production',
  VITE_APP_VERSION: process.env.VITE_APP_VERSION || '1.0.0',
  VITE_WECOM_CORP_ID: process.env.VITE_WECOM_CORP_ID || '',
  VITE_WECOM_AGENT_ID: process.env.VITE_WECOM_AGENT_ID || ''
};

// 配置API端点
app.get('/api/config', (req, res) => {
  res.json({
    VITE_SUPABASE_URL: config.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: config.VITE_SUPABASE_ANON_KEY,
    VITE_APP_ENV: config.VITE_APP_ENV,
    VITE_APP_VERSION: config.VITE_APP_VERSION,
    VITE_WECOM_CORP_ID: config.VITE_WECOM_CORP_ID,
    VITE_WECOM_AGENT_ID: config.VITE_WECOM_AGENT_ID,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.VITE_APP_ENV,
    version: config.VITE_APP_VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  });
});

// Supabase代理端点（如果需要）
app.all('/api/supabase/*', (req, res) => {
  const targetUrl = `${config.VITE_SUPABASE_URL}${req.path.replace('/api/supabase', '')}`;
  
  // 这里可以添加代理逻辑
  res.json({
    message: 'Supabase proxy endpoint',
    targetUrl: targetUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务 - 支持Vite构建的文件结构
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d', // 缓存1天
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // 为HTML文件设置不缓存
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // 为JS/CSS文件设置长期缓存
    if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年
    }
    // 为JSON文件设置中等缓存
    if (filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1小时
    }
  }
}));

// SPA路由支持 - 所有其他请求都返回index.html
app.get('*', (req, res) => {
  // 如果是API请求，返回404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  // 其他请求返回index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 函数计算入口
module.exports.handler = (event, context, callback) => {
  console.log('Function invoked:', {
    requestId: context.requestId,
    functionName: context.function.name,
    functionVersion: context.function.version,
    event: JSON.stringify(event, null, 2)
  });

  // 处理HTTP事件
  if (event.httpMethod) {
    // 这是HTTP触发器
    const server = app.listen(0, () => {
      const port = server.address().port;
      
      // 模拟HTTP请求
      const req = {
        method: event.httpMethod,
        url: event.path || '/',
        headers: event.headers || {},
        body: event.body || '',
        query: event.queryParameters || {},
        ip: event.requestContext?.sourceIp || '127.0.0.1',
        userAgent: event.headers?.['User-Agent'] || 'FunctionCompute'
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
          server.close();
          
          // 处理响应
          const response = {
            statusCode: this.statusCode,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              ...this.headers
            },
            body: this.body
          };
          
          console.log('Response:', {
            statusCode: response.statusCode,
            headers: response.headers,
            bodyLength: response.body.length
          });
          
          callback(null, response);
        }
      };
      
      // 处理请求
      try {
        app(req, res);
      } catch (error) {
        console.error('Request processing error:', error);
        server.close();
        callback(error);
      }
    });
  } else {
    // 其他类型的事件
    callback(null, { 
      message: 'Function executed successfully',
      timestamp: new Date().toISOString(),
      config: {
        environment: config.VITE_APP_ENV,
        version: config.VITE_APP_VERSION
      },
      event: event
    });
  }
};

// 本地开发服务器
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Local: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${config.VITE_APP_ENV}`);
    console.log(`📦 Version: ${config.VITE_APP_VERSION}`);
  });
}
