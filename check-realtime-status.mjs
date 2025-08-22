#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔍 检查 Supabase Realtime 状态...');
console.log('==================================');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseAnonKey ? '已设置' : '未设置'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 环境变量缺失');
  process.exit(1);
}

// 创建客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('\n🔌 测试基本连接...');

try {
  // 测试基本连接
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .limit(1);
  
  if (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('错误详情:', error);
  } else {
    console.log('✅ 数据库连接成功');
    console.log('notifications 表可访问');
  }
} catch (err) {
  console.error('❌ 数据库连接异常:', err.message);
}

console.log('\n🌐 测试 Realtime 连接...');

try {
  const channel = supabase
    .channel('test-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('✅ 收到实时事件:', payload);
    })
    .subscribe((status) => {
      console.log(`📡 Realtime 状态: ${status}`);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime 连接成功!');
        console.log('\n🎉 恭喜！Realtime 功能正常工作');
        setTimeout(() => {
          supabase.removeChannel(channel);
          process.exit(0);
        }, 3000);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime 连接失败');
        console.log('\n🔍 问题分析:');
        console.log('1. 数据库连接正常，但 Realtime 功能未启用');
        console.log('2. 需要在 Supabase Dashboard 中启用 Realtime');
        console.log('3. 或者阿里云 Supabase 不支持 Realtime 功能');
        
        console.log('\n🛠️ 解决方案:');
        console.log('方案1: 在 Supabase Dashboard 中启用 Realtime');
        console.log('  1. 进入 Database → Replication');
        console.log('  2. 启用以下表的实时复制:');
        console.log('     - notifications');
        console.log('     - announcements');
        console.log('     - announcement_reads');
        
        console.log('\n方案2: 使用轮询替代 Realtime');
        console.log('  1. 修改 useRealtimeNotifications.ts');
        console.log('  2. 添加定时轮询机制');
        console.log('  3. 移除 WebSocket 订阅');
        
        console.log('\n方案3: 检查阿里云 Supabase 配置');
        console.log('  1. 确认是否支持 Realtime 功能');
        console.log('  2. 检查是否需要特殊配置');
        console.log('  3. 联系阿里云技术支持');
        
        setTimeout(() => {
          supabase.removeChannel(channel);
          process.exit(1);
        }, 5000);
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ 连接超时');
      } else if (status === 'CLOSED') {
        console.log('🔌 连接已关闭');
      }
    });
    
  // 设置超时
  setTimeout(() => {
    console.log('⏰ Realtime 连接超时');
    supabase.removeChannel(channel);
    process.exit(1);
  }, 10000);
  
} catch (err) {
  console.error('❌ Realtime 连接异常:', err.message);
}
