import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9000;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API代理配置（如果需要）
// app.use('/api', createProxyMiddleware({
//   target: 'https://your-api-endpoint.com',
//   changeOrigin: true,
//   pathRewrite: {
//     '^/api': ''
//   }
// }));

// SPA路由支持 - 所有路由都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM Web Application running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// 导出处理函数（函数计算需要）
export const handler = (event, context, callback) => {
  // 这里可以添加函数计算特定的处理逻辑
  // 对于静态网站，主要依赖Express服务器
  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: 'CRM Web Application is running'
  });
};
