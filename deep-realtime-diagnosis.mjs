#!/usr/bin/env node

/**
 * 深入诊断 Realtime 服务连接失败原因
 * 分析服务器端配置和网络问题
 */

import { createClient } from '@supabase/supabase-js';

// 配置信息
const SUPABASE_URL = 'http://8.159.21.226:8000';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE';

console.log('🔍 开始深入诊断 Realtime 服务连接失败原因...\n');

// 1. 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. 测试各种服务端点
const testEndpoints = async () => {
  console.log('1️⃣ 测试各种服务端点...\n');
  
  const endpoints = [
    { name: 'Auth 服务', path: '/auth/v1/token', method: 'POST' },
    { name: 'REST API', path: '/rest/v1/notifications', method: 'GET' },
    { name: 'Realtime 服务', path: '/realtime/v1/websocket', method: 'GET' },
    { name: 'Edge Functions', path: '/functions/v1/', method: 'GET' },
    { name: 'Storage 服务', path: '/storage/v1/', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${SUPABASE_URL}${endpoint.path}`;
      console.log(`测试 ${endpoint.name}: ${url}`);
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`  状态: ${response.status} ${response.statusText}`);
      
      if (response.status === 503) {
        const errorText = await response.text();
        console.log(`  错误: ${errorText}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`  错误: ${error.message}\n`);
    }
  }
};

// 3. 测试 WebSocket 连接的不同场景
const testWebSocketScenarios = async () => {
  console.log('2️⃣ 测试 WebSocket 连接场景...\n');
  
  const scenarios = [
    {
      name: '基本 WebSocket 握手',
      url: `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}`,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='
      }
    },
    {
      name: '带用户认证的 WebSocket',
      url: `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&user_id=1`,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='
      }
    }
  ];
  
  for (const scenario of scenarios) {
    try {
      console.log(`测试 ${scenario.name}:`);
      console.log(`URL: ${scenario.url}`);
      
      const response = await fetch(scenario.url, {
        method: 'GET',
        headers: scenario.headers
      });
      
      console.log(`  状态: ${response.status} ${response.statusText}`);
      
      if (response.status === 503) {
        const errorText = await response.text();
        console.log(`  错误详情: ${errorText}`);
        
        // 分析错误信息
        if (errorText.includes('name resolution failed')) {
          console.log('  🔍 分析: DNS 解析失败');
          console.log('  💡 可能原因:');
          console.log('    - 服务器内部 DNS 配置错误');
          console.log('    - Realtime 服务依赖的域名无法解析');
          console.log('    - 网络配置问题');
        }
      }
      
      console.log('');
    } catch (error) {
      console.log(`  错误: ${error.message}\n`);
    }
  }
};

// 4. 分析服务器架构和配置
const analyzeServerArchitecture = () => {
  console.log('3️⃣ 分析服务器架构和配置...\n');
  
  console.log('📊 服务器信息:');
  console.log(`  • 公共地址: ${SUPABASE_URL}`);
  console.log(`  • 私有地址: 172.29.115.112:8000`);
  console.log(`  • 区域: cn-shanghai`);
  console.log(`  • 可用区: cn-shanghai-l`);
  console.log(`  • 引擎: PostgreSQL 15.0`);
  console.log(`  • 规格: 1C2G`);
  console.log(`  • 存储: 1GB`);
  console.log(`  • 状态: running`);
  console.log('');
  
  console.log('🔍 架构分析:');
  console.log('  • 使用 Kong 网关 (版本 2.8.1)');
  console.log('  • 支持 WebSocket 升级');
  console.log('  • 有完整的认证机制');
  console.log('  • Realtime 服务独立部署');
  console.log('');
  
  console.log('🚨 问题分析:');
  console.log('  • "name resolution failed" 错误表明:');
  console.log('    - Realtime 服务本身是启动的');
  console.log('    - 但无法解析某些必要的域名');
  console.log('    - 可能是内部 DNS 配置问题');
  console.log('    - 或者是服务依赖配置错误');
  console.log('');
};

// 5. 提供解决方案建议
const provideSolutions = () => {
  console.log('4️⃣ 解决方案建议...\n');
  
  console.log('🛠️ 立即解决方案:');
  console.log('  1. 实现客户端轮询机制');
  console.log('  2. 设置合理的刷新间隔 (30-60秒)');
  console.log('  3. 保持用户体验的同时避免连接问题');
  console.log('');
  
  console.log('🔧 服务器端修复:');
  console.log('  1. 检查 Realtime 服务 DNS 配置');
  console.log('  2. 验证服务依赖和网络配置');
  console.log('  3. 检查内部域名解析设置');
  console.log('  4. 重启 Realtime 相关服务');
  console.log('');
  
  console.log('📋 具体检查项目:');
  console.log('  • /etc/resolv.conf 配置');
  console.log('  • Docker 网络配置 (如果使用容器)');
  console.log('  • 服务间通信配置');
  console.log('  • 防火墙和安全组设置');
  console.log('');
  
  console.log('🎯 根本原因:');
  console.log('  Realtime 服务无法解析某些必要的域名，');
  console.log('  这通常是由于服务器内部网络配置问题导致的。');
  console.log('  不是客户端配置问题，而是服务器端基础设施问题。');
  console.log('');
};

// 6. 执行诊断
const runDiagnosis = async () => {
  try {
    await testEndpoints();
    await testWebSocketScenarios();
    analyzeServerArchitecture();
    provideSolutions();
    
    console.log('🏁 深入诊断完成');
    console.log('\n📞 建议联系服务器管理员检查:');
    console.log('  1. Realtime 服务 DNS 配置');
    console.log('  2. 内部网络设置');
    console.log('  3. 服务依赖关系');
    
  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error.message);
  }
};

// 运行诊断
runDiagnosis();
