import { createClient } from '@supabase/supabase-js';

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotificationFunction() {
  console.log('🔍 开始测试通知系统函数...\n');
  
  try {
    // 1. 测试函数端点可访问性
    console.log('1. 测试函数端点可访问性...');
    const functionUrl = `${supabaseUrl}/functions/v1/notification-system`;
    
    // 测试基本连接
    try {
      const response = await fetch(`${functionUrl}?action=stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      console.log('📡 函数端点响应状态:', response.status);
      console.log('📡 函数端点响应头:', Object.fromEntries(response.headers.entries()));
      
      if (response.status === 401) {
        console.log('✅ 函数端点可访问，需要用户认证（正常）');
      } else if (response.status === 200) {
        const data = await response.json();
        console.log('✅ 函数端点正常工作，返回数据:', data);
      } else {
        console.log('⚠️ 函数端点返回状态:', response.status);
        const errorText = await response.text();
        console.log('📄 响应内容:', errorText);
      }
    } catch (error) {
      console.error('❌ 函数端点测试失败:', error.message);
    }
    
    // 2. 测试OPTIONS请求（CORS预检）
    console.log('\n2. 测试CORS预检请求...');
    try {
      const corsResponse = await fetch(functionUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5177',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      });
      
      console.log('📡 CORS预检响应状态:', corsResponse.status);
      console.log('📡 CORS响应头:', Object.fromEntries(corsResponse.headers.entries()));
      
      if (corsResponse.status === 200) {
        console.log('✅ CORS配置正常');
      } else {
        console.log('⚠️ CORS配置可能有问题');
      }
    } catch (error) {
      console.error('❌ CORS测试失败:', error.message);
    }
    
    // 3. 检查函数部署状态
    console.log('\n3. 检查函数部署状态...');
    try {
      const { data: functions, error } = await supabase.functions.list();
      if (error) {
        console.error('❌ 获取函数列表失败:', error.message);
      } else {
        const notificationFunction = functions.find(f => f.name === 'notification-system');
        if (notificationFunction) {
          console.log('✅ 通知系统函数已部署');
          console.log('   函数名称:', notificationFunction.name);
          console.log('   函数状态:', notificationFunction.status);
          console.log('   函数版本:', notificationFunction.version);
          console.log('   更新时间:', notificationFunction.updated_at);
        } else {
          console.log('❌ 未找到通知系统函数');
        }
      }
    } catch (error) {
      console.log('⚠️ 无法检查函数列表（可能需要管理员权限）');
    }
    
    // 4. 测试数据库连接
    console.log('\n4. 测试数据库连接...');
    try {
      const { data: notifications, error: dbError } = await supabase
        .from('notifications')
        .select('count')
        .limit(1);
      
      if (dbError) {
        console.error('❌ 数据库连接失败:', dbError.message);
      } else {
        console.log('✅ 数据库连接正常');
      }
    } catch (error) {
      console.error('❌ 数据库测试失败:', error.message);
    }
    
    // 5. 检查环境变量
    console.log('\n5. 检查环境变量...');
    console.log('   SUPABASE_URL:', supabaseUrl);
    console.log('   SUPABASE_ANON_KEY:', supabaseKey.substring(0, 20) + '...');
    
    // 6. 测试函数URL构建
    console.log('\n6. 测试函数URL构建...');
    const testActions = ['notifications', 'announcements', 'stats', 'create_notification'];
    
    testActions.forEach(action => {
      const url = `${functionUrl}?action=${action}`;
      console.log(`   ${action}: ${url}`);
    });
    
    // 7. 测试函数文件是否存在
    console.log('\n7. 检查函数文件...');
    const fs = await import('fs');
    const path = await import('path');
    
    const functionPath = './supabase/functions/notification-system/index.ts';
    if (fs.existsSync(functionPath)) {
      console.log('✅ 函数文件存在:', functionPath);
      
      // 检查文件大小
      const stats = fs.statSync(functionPath);
      console.log('   文件大小:', stats.size, '字节');
      
      // 检查文件内容
      const content = fs.readFileSync(functionPath, 'utf8');
      console.log('   文件行数:', content.split('\n').length);
      console.log('   包含serve函数:', content.includes('serve('));
      console.log('   包含CORS配置:', content.includes('corsHeaders'));
    } else {
      console.log('❌ 函数文件不存在:', functionPath);
    }
    
    console.log('\n✅ 通知系统函数测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
testNotificationFunction().then(() => {
  console.log('\n🎯 测试脚本执行完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 测试脚本执行失败:', error);
  process.exit(1);
}); 