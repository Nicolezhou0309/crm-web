// 调试ANY操作符问题
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

async function debugAnyOperator() {
  console.log('🧪 开始调试ANY操作符问题...');
  
  try {
    // 测试1：检查函数是否真的更新了
    console.log('\n📋 测试1：检查函数是否真的更新了');
    console.log('💡 如果函数没有更新，错误信息应该还是之前的版本');
    console.log('💡 如果函数已更新，应该能看到新的错误信息或成功结果');
    
    // 测试2：尝试不同的参数组合来定位问题
    console.log('\n📋 测试2：尝试不同的参数组合来定位问题');
    
    // 测试2.1：只传limit
    console.log('🔍 测试2.1：只传p_limit');
    try {
      const { data: limitResult, error: limitError } = await supabase.rpc('filter_followups', {
        p_limit: 5
      });
      
      if (limitError) {
        console.error('❌ 只传p_limit失败:', limitError);
      } else {
        console.log('✅ 只传p_limit成功:', { 
          resultCount: limitResult?.length || 0
        });
      }
    } catch (err) {
      console.error('❌ 只传p_limit异常:', err.message);
    }
    
    // 测试2.2：只传offset
    console.log('\n🔍 测试2.2：只传p_offset');
    try {
      const { data: offsetResult, error: offsetError } = await supabase.rpc('filter_followups', {
        p_offset: 0
      });
      
      if (offsetError) {
        console.error('❌ 只传p_offset失败:', offsetError);
      } else {
        console.log('✅ 只传p_offset成功:', { 
          resultCount: offsetResult?.length || 0
        });
      }
    } catch (err) {
      console.error('❌ 只传p_offset异常:', err.message);
    }
    
    // 测试2.3：传空数组参数
    console.log('\n🔍 测试2.3：传空数组参数');
    try {
      const { data: emptyArrayResult, error: emptyArrayError } = await supabase.rpc('filter_followups', {
        p_limit: 5,
        p_offset: 0,
        p_worklocation: []
      });
      
      if (emptyArrayError) {
        console.error('❌ 传空数组参数失败:', emptyArrayError);
      } else {
        console.log('✅ 传空数组参数成功:', { 
          resultCount: emptyArrayResult?.length || 0
        });
      }
    } catch (err) {
      console.error('❌ 传空数组参数异常:', err.message);
    }
    
    // 测试2.4：传null参数
    console.log('\n🔍 测试2.4：传null参数');
    try {
      const { data: nullResult, error: nullError } = await supabase.rpc('filter_followups', {
        p_limit: 5,
        p_offset: 0,
        p_worklocation: null
      });
      
      if (nullError) {
        console.error('❌ 传null参数失败:', nullError);
      } else {
        console.log('✅ 传null参数成功:', { 
          resultCount: nullResult?.length || 0
        });
      }
    } catch (err) {
      console.error('❌ 传null参数异常:', err.message);
    }
    
    // 测试3：分析错误模式
    console.log('\n📋 测试3：分析错误模式');
    console.log('💡 如果某些参数组合成功，某些失败，可以帮助定位问题');
    console.log('💡 如果所有测试都失败，说明问题在函数的基础逻辑');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
debugAnyOperator().then(() => {
  console.log('\n🏁 ANY操作符调试完成');
}).catch(error => {
  console.error('❌ ANY操作符调试失败:', error);
});
