import { loadEnv } from 'vite';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 函数计算专用Vite配置
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    // 基础路径配置 - 适配函数计算
    base: mode === 'production' ? '/' : '/',
    
    server: {
      port: 5177,
      host: '0.0.0.0',
      hmr: {
        overlay: true,
        timeout: 30000,
        port: 5177,
      },
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/fc-app/**'
        ],
        usePolling: false,
        interval: 100
      }
    },
    
    // 构建配置 - 优化函数计算部署
    build: {
      // 输出目录
      outDir: 'dist',
      
      // 清空输出目录
      emptyOutDir: true,
      
      // 资源内联阈值
      assetsInlineLimit: 4096,
      
      // 代码分割配置
      rollupOptions: {
        output: {
          // 手动代码分割
          manualChunks: {
            // 核心框架
            vendor: ['react', 'react-dom'],
            
            // UI库
            antd: ['antd', '@ant-design/charts'],
            
            // 数据库和认证
            supabase: ['@supabase/supabase-js'],
            
            // 工具库
            utils: ['lodash', 'dayjs', 'uuid'],
            
            // 路由
            router: ['react-router-dom'],
            
            // 其他第三方库
            thirdparty: ['canvas-confetti', 'lottie-react', 'react-pivot']
          },
          
          // 资源文件命名
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
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
          }
        }
      },
      
      // 压缩配置
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      },
      
      // 源码映射
      sourcemap: mode === 'development',
      
      // 目标环境
      target: 'es2015',
      
      // CSS代码分割
      cssCodeSplit: true
    },
    
    // 依赖优化
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'antd',
        '@supabase/supabase-js',
        'react-router-dom',
        'lodash',
        'dayjs'
      ],
      exclude: ['@vite/client', '@vite/env']
    },
    
    // 环境变量配置
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __ENVIRONMENT__: JSON.stringify(mode)
    },
    
    // 解析配置
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@pages': '/src/pages',
        '@utils': '/src/utils',
        '@services': '/src/services',
        '@types': '/src/types',
        '@hooks': '/src/hooks',
        '@context': '/src/context'
      }
    },
    
    // CSS配置
    css: {
      devSourcemap: mode === 'development',
      preprocessorOptions: {
        css: {
          charset: false
        }
      }
    },
    
    // 预览配置
    preview: {
      port: 4173,
      host: '0.0.0.0'
    }
  };
});
