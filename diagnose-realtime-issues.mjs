#!/usr/bin/env node

/**
 * 实时通知问题诊断脚本
 * 分析 Supabase 实时通知服务的状态和配置
 */

import { createClient } from '@supabase/supabase-js';

// 配置信息
const SUPABASE_URL = 'http://8.159.21.226:8000';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE';

console.log('🔍 开始诊断 Supabase 实时通知问题...\n');

// 1. 创建 Supabase 客户端
console.log('1️⃣ 创建 Supabase 客户端...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

console.log('✅ 客户端创建成功');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);

// 2. 测试基本连接
console.log('2️⃣ 测试基本连接...');
try {
  const { data, error } = await supabase.from('notifications').select('count').limit(1);
  if (error) {
    console.log('❌ 数据库连接失败:', error.message);
  } else {
    console.log('✅ 数据库连接正常');
  }
} catch (err) {
  console.log('❌ 连接异常:', err.message);
}
console.log('');

// 3. 测试实时通知订阅
console.log('3️⃣ 测试实时通知订阅...');

let subscriptionStatus = 'UNKNOWN';
let connectionAttempts = 0;
const maxAttempts = 3;

const testRealtimeSubscription = () => {
  return new Promise((resolve) => {
    const channel = supabase
      .channel('test-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('📡 收到实时更新:', payload);
      })
      .subscribe((status) => {
        subscriptionStatus = status;
        console.log(`📡 订阅状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 实时订阅成功!');
          resolve({ success: true, status });
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ 实时订阅失败');
          resolve({ success: false, status, error: 'CHANNEL_ERROR' });
        } else if (status === 'TIMED_OUT') {
          console.log('⏰ 订阅超时');
          resolve({ success: false, status, error: 'TIMED_OUT' });
        } else if (status === 'CLOSED') {
          console.log('🔒 订阅已关闭');
          resolve({ success: false, status, error: 'CLOSED' });
        }
        
        // 设置超时
        setTimeout(() => {
          if (subscriptionStatus === 'UNKNOWN') {
            console.log('⏰ 订阅状态未知，可能超时');
            resolve({ success: false, status: 'UNKNOWN', error: 'TIMEOUT' });
          }
        }, 10000);
      });
    
    // 清理函数
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 15000);
  });
};

// 4. 执行诊断
console.log('4️⃣ 执行诊断测试...\n');

try {
  const result = await testRealtimeSubscription();
  
  console.log('\n📊 诊断结果:');
  console.log('================');
  console.log(`订阅状态: ${result.status}`);
  console.log(`是否成功: ${result.success ? '✅ 是' : '❌ 否'}`);
  
  if (!result.success) {
    console.log(`错误类型: ${result.error}`);
    
    // 分析可能的原因
    console.log('\n🔍 可能的原因分析:');
    if (result.error === 'CHANNEL_ERROR') {
      console.log('• WebSocket 连接失败');
      console.log('• 实时服务不可用');
      console.log('• 网络配置问题');
    } else if (result.error === 'TIMED_OUT') {
      console.log('• 连接超时');
      console.log('• 服务器响应慢');
      console.log('• 网络延迟高');
    } else if (result.error === 'CLOSED') {
      console.log('• 连接被关闭');
      console.log('• 服务器主动断开');
      console.log('• 认证问题');
    }
    
    console.log('\n💡 建议解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 验证 Supabase 实例状态');
    console.log('3. 检查防火墙设置');
    console.log('4. 联系 Supabase 支持');
  }
  
} catch (error) {
  console.log('❌ 诊断过程中发生错误:', error.message);
}

console.log('\n🏁 诊断完成');
