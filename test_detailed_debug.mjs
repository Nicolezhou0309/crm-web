// 详细调试测试脚本
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  console.log('✅ 环境变量加载成功');
} catch (error) {
  console.warn('⚠️ 无法加载.env文件，使用默认值');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function detailedDebugTest() {
  console.log('🧪 开始详细调试测试...');
  
  try {
    // 测试1：检查数据库连接
    console.log('\n📋 测试1：检查数据库连接');
    
    const { data: connectionTest, error: connectionError } = await supabase
      .from('followups')
      .select('id')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ 数据库连接失败:', connectionError);
      return;
    } else {
      console.log('✅ 数据库连接成功');
    }
    
    // 测试2：尝试最简单的函数调用
    console.log('\n📋 测试2：最简单的函数调用');
    
    try {
      const { data: simpleResult, error: simpleError } = await supabase
        .rpc('filter_followups', {});
      
      if (simpleError) {
        console.error('❌ 空参数调用失败:', simpleError);
      } else {
        console.log('✅ 空参数调用成功:', { 
          resultCount: simpleResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ 空参数调用异常:', error);
    }
    
    // 测试3：尝试只传limit参数
    console.log('\n📋 测试3：只传limit参数');
    
    try {
      const { data: limitResult, error: limitError } = await supabase
        .rpc('filter_followups', {
          p_limit: 1
        });
      
      if (limitError) {
        console.error('❌ limit参数调用失败:', limitError);
      } else {
        console.log('✅ limit参数调用成功:', { 
          resultCount: limitResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ limit参数调用异常:', error);
    }
    
    // 测试4：尝试只传offset参数
    console.log('\n📋 测试4：只传offset参数');
    
    try {
      const { data: offsetResult, error: offsetError } = await supabase
        .rpc('filter_followups', {
          p_offset: 0
        });
      
      if (offsetError) {
        console.error('❌ offset参数调用失败:', offsetError);
      } else {
        console.log('✅ offset参数调用成功:', { 
          resultCount: offsetResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ offset参数调用异常:', error);
    }
    
    // 测试5：尝试只传非数组参数
    console.log('\n📋 测试5：只传非数组参数');
    
    try {
      const { data: nonArrayResult, error: nonArrayError } = await supabase
        .rpc('filter_followups', {
          p_limit: 1,
          p_offset: 0,
          p_keyword: 'test'
        });
      
      if (nonArrayError) {
        console.error('❌ 非数组参数调用失败:', nonArrayError);
      } else {
        console.log('✅ 非数组参数调用成功:', { 
          resultCount: nonArrayResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ 非数组参数调用异常:', error);
    }
    
    // 测试6：检查函数定义
    console.log('\n📋 测试6：检查函数定义');
    
    try {
      const { data: functionDef, error: functionDefError } = await supabase
        .rpc('pg_get_functiondef', {
          func_oid: 'filter_followups'
        });
      
      if (functionDefError) {
        console.error('❌ 函数定义检查失败:', functionDefError);
      } else {
        console.log('✅ 函数定义检查成功');
        console.log('🔍 函数定义片段:', functionDef?.substring(0, 200));
      }
    } catch (error) {
      console.error('❌ 函数定义检查异常:', error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

detailedDebugTest().then(() => {
  console.log('\n🏁 详细调试测试完成');
}).catch(error => {
  console.error('❌ 详细调试测试失败:', error);
});
