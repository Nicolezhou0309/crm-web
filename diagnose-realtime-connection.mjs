#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔍 诊断 Supabase Realtime 连接问题...');
console.log('=====================================');

// 检查环境变量
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n📋 环境变量检查:');
console.log(`- VITE_SUPABASE_URL: ${supabaseUrl || '❌ 未设置'}`);
console.log(`- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ 已设置' : '❌ 未设置'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ 环境变量配置不完整，请检查 .env 文件');
  process.exit(1);
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

console.log('\n🔌 测试基本连接...');

try {
  // 测试基本连接
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .limit(1);
  
  if (error) {
    console.error('❌ 基本连接失败:', error.message);
  } else {
    console.log('✅ 基本连接成功');
  }
} catch (err) {
  console.error('❌ 连接异常:', err.message);
}

console.log('\n🌐 测试 Realtime 连接...');

try {
  // 测试 Realtime 连接
  const channel = supabase
    .channel('test-connection')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('✅ 收到实时事件:', payload);
    })
    .subscribe((status) => {
      console.log(`📡 订阅状态: ${status}`);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime 连接成功!');
        // 5秒后关闭连接
        setTimeout(() => {
          supabase.removeChannel(channel);
          console.log('🔌 测试连接已关闭');
          process.exit(0);
        }, 5000);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime 连接失败');
        console.log('\n🔍 可能的原因:');
        console.log('1. 网络连接问题');
        console.log('2. 防火墙阻止');
        console.log('3. Supabase 服务不可用');
        console.log('4. 认证问题');
        console.log('5. 表权限问题');
        
        // 检查表是否存在
        checkTablePermissions();
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ 连接超时');
      } else if (status === 'CLOSED') {
        console.log('🔌 连接已关闭');
      }
    });
    
  // 设置超时
  setTimeout(() => {
    console.log('⏰ 连接超时，强制退出');
    supabase.removeChannel(channel);
    process.exit(1);
  }, 10000);
  
} catch (err) {
  console.error('❌ Realtime 连接异常:', err.message);
}

async function checkTablePermissions() {
  console.log('\n🔍 检查表权限...');
  
  try {
    // 检查 notifications 表是否存在
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'notifications');
    
    if (tableError) {
      console.error('❌ 查询表信息失败:', tableError.message);
      return;
    }
    
    if (tables && tables.length > 0) {
      console.log('✅ notifications 表存在');
      
      // 检查表权限
      const { data: permissions, error: permError } = await supabase
        .from('information_schema.table_privileges')
        .select('privilege_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'notifications');
      
      if (permError) {
        console.log('⚠️  无法检查表权限:', permError.message);
      } else {
        console.log('📋 表权限:', permissions?.map(p => p.privilege_type) || []);
      }
    } else {
      console.log('❌ notifications 表不存在');
    }
    
    // 检查 RLS 策略
    console.log('\n🔒 检查 RLS 策略...');
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'notifications');
    
    if (policyError) {
      console.log('⚠️  无法检查 RLS 策略:', policyError.message);
    } else {
      console.log('📋 RLS 策略数量:', policies?.length || 0);
      if (policies && policies.length > 0) {
        policies.forEach((policy, index) => {
          console.log(`  ${index + 1}. ${policy.policyname} (${policy.cmd})`);
        });
      }
    }
    
  } catch (err) {
    console.error('❌ 权限检查异常:', err.message);
  }
}
