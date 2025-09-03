const path = require('path');
const fs = require('fs');

// 环境变量配置
const config = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE',
  VITE_APP_ENV: process.env.VITE_APP_ENV || 'production',
  VITE_APP_VERSION: process.env.VITE_APP_VERSION || '1.0.0'
};

// 函数计算入口
module.exports.handler = (event, context, callback) => {
  console.log('Function invoked:', {
    requestId: context.requestId,
    functionName: context.function.name,
    event: JSON.stringify(event, null, 2)
  });

  try {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    // 处理API请求
    if (path.startsWith('/api/')) {
      if (path === '/api/health') {
        const response = {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config.VITE_APP_ENV,
            version: config.VITE_APP_VERSION
          })
        };
        callback(null, response);
        return;
      }
      
      if (path === '/api/config') {
        const response = {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            VITE_SUPABASE_URL: config.VITE_SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: config.VITE_SUPABASE_ANON_KEY,
            VITE_APP_ENV: config.VITE_APP_ENV,
            VITE_APP_VERSION: config.VITE_APP_VERSION,
            timestamp: new Date().toISOString()
          })
        };
        callback(null, response);
        return;
      }
      
      // 其他API请求返回404
      const response = {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'API endpoint not found',
          path: path
        })
      };
      callback(null, response);
      return;
    }
    
    // 处理静态文件请求
    const distPath = path.join(__dirname, 'dist');
    let filePath;
    
    if (path === '/') {
      filePath = path.join(distPath, 'index.html');
    } else {
      // 检查是否是静态资源
      const staticPath = path.join(distPath, path.substring(1));
      if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        filePath = staticPath;
      } else {
        // SPA路由，返回index.html
        filePath = path.join(distPath, 'index.html');
      }
    }
    
    // 读取文件
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath);
      
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json') contentType = 'application/json';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.woff') contentType = 'font/woff';
      else if (ext === '.woff2') contentType = 'font/woff2';
      
      const response = {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
        },
        body: content
      };
      callback(null, response);
    } else {
      // 文件不存在
      const response = {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<h1>404 Not Found</h1>'
      };
      callback(null, response);
    }
    
  } catch (error) {
    console.error('Function error:', error);
    const response = {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
    callback(null, response);
  }
};
