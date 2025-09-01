// 最小化RPC测试 - 逐步定位问题
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });
  
  // 设置环境变量
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  console.log('✅ 环境变量加载成功');
} catch (error) {
  console.warn('⚠️ 无法加载.env文件，使用默认值');
}

// 配置Supabase客户端 - 使用服务角色密钥
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testMinimalRPC() {
  console.log('🧪 开始最小化RPC测试...');
  
  try {
    // 测试1：只传分页参数
    console.log('\n📋 测试1：只传分页参数');
    const minParams = {
      p_limit: 5,
      p_offset: 0
    };
    
    const { data: minResult, error: minError } = await supabase.rpc('filter_followups', minParams);
    
    if (minError) {
      console.error('❌ 最小参数测试失败:', minError);
    } else {
      console.log('✅ 最小参数测试成功:', { 
        resultCount: minResult?.length || 0
      });
    }
    
    // 测试2：添加工作地点参数
    console.log('\n📋 测试2：添加工作地点参数');
    const worklocationParams = {
      p_limit: 5,
      p_offset: 0,
      p_worklocation: ['联航路']
    };
    
    const { data: workResult, error: workError } = await supabase.rpc('filter_followups', worklocationParams);
    
    if (workError) {
      console.error('❌ 工作地点参数测试失败:', workError);
    } else {
      console.log('✅ 工作地点参数测试成功:', { 
        resultCount: workResult?.length || 0
      });
    }
    
    // 测试3：添加更多数组参数
    console.log('\n📋 测试3：添加更多数组参数');
    const moreParams = {
      p_limit: 5,
      p_offset: 0,
      p_worklocation: ['联航路'],
      p_leadid: ['25A00006'],
      p_followupstage: ['已预约']
    };
    
    const { data: moreResult, error: moreError } = await supabase.rpc('filter_followups', moreParams);
    
    if (moreError) {
      console.error('❌ 更多参数测试失败:', moreError);
    } else {
      console.log('✅ 更多参数测试成功:', { 
        resultCount: moreResult?.length || 0
      });
    }
    
    // 测试4：检查函数是否更新
    console.log('\n📋 测试4：检查函数是否更新');
    console.log('💡 如果函数没有更新，错误信息应该还是之前的版本');
    console.log('💡 如果函数已更新，应该能看到新的错误信息或成功结果');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testMinimalRPC().then(() => {
  console.log('\n🏁 最小化RPC测试完成');
}).catch(error => {
  console.error('❌ 最小化RPC测试失败:', error);
});
