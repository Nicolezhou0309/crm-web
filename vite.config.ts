import { loadEnv } from 'vite';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    // 定义环境变量，确保在生产构建中正确替换
    define: {
      'import.meta.env.VITE_WECOM_CORP_ID': JSON.stringify(env.VITE_WECOM_CORP_ID),
      'import.meta.env.VITE_WECOM_AGENT_ID': JSON.stringify(env.VITE_WECOM_AGENT_ID),
      'import.meta.env.VITE_WECOM_REDIRECT_URI': JSON.stringify(env.VITE_WECOM_REDIRECT_URI),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
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
      // 启用文件哈希，确保长期缓存
      rollupOptions: {
        output: {
          // 为所有资源文件添加哈希值
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name)) {
              return `assets/css/[name]-[hash].${ext}`;
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
              return `assets/images/[name]-[hash].${ext}`;
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
              return `assets/fonts/[name]-[hash].${ext}`;
            }
            return `assets/[name]-[hash].${ext}`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          manualChunks: {
            vendor: ['react', 'react-dom'],
            antd: ['antd'],
            supabase: ['@supabase/supabase-js'],
            charts: ['@ant-design/charts'],
            utils: ['lodash', 'dayjs', 'uuid']
          }
        }
      },
      // 启用 CSS 代码分割
      cssCodeSplit: true,
      // 设置 chunk 大小警告限制
      chunkSizeWarningLimit: 1000,
      // 启用 sourcemap（生产环境可选）
      sourcemap: false,
      // 压缩配置
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // 移除 console.log
          drop_debugger: true // 移除 debugger
        }
      }
    },
    // 优化开发体验
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd', '@supabase/supabase-js']
    }
  };
});