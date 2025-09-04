import { loadEnv } from 'vite';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5177, // 固定端口，匹配邀请链接
      host: '0.0.0.0', // 允许外部访问
      hmr: {
        // 启用热更新覆盖层，显示错误信息
        overlay: true, // 启用错误覆盖层
        timeout: 30000, // 保持超时时间
        port: 5177, // 固定HMR端口
      },
      watch: {
        // 移除文件忽略限制，允许所有文件变化触发热更新
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**'
        ],
        // 启用轮询作为WebSocket的降级方案
        usePolling: true,
        interval: 1000 // 1秒轮询间隔，避免WebSocket不安全连接问题
      }
    },
    // 优化构建配置
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            antd: ['antd'],
            supabase: ['@supabase/supabase-js']
          }
        }
      }
    },
    // 优化开发体验
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd', '@supabase/supabase-js']
    }
  };
});