// 简化的调试测试脚本
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

async function simpleDebugTest() {
  console.log('🧪 开始简化调试测试...');
  
  try {
    // 测试1：最简单的调用，只传limit
    console.log('\n📋 测试1：最简单的调用');
    
    const { data: simpleResult, error: simpleError } = await supabase
      .rpc('filter_followups', {
        p_limit: 1
      });
    
    if (simpleError) {
      console.error('❌ 简单调用失败:', simpleError);
    } else {
      console.log('✅ 简单调用成功:', { 
        resultCount: simpleResult?.length || 0,
        sampleData: simpleResult?.[0] ? {
          id: simpleResult[0].id,
          leadid: simpleResult[0].leadid,
          worklocation: simpleResult[0].worklocation
        } : null
      });
    }
    
    // 测试2：只传工作地点，不传其他参数
    console.log('\n📋 测试2：只传工作地点参数');
    
    const { data: worklocationResult, error: worklocationError } = await supabase
      .rpc('filter_followups', {
        p_worklocation: ['联航路'],
        p_limit: 1
      });
    
    if (worklocationError) {
      console.error('❌ 工作地点参数失败:', worklocationError);
    } else {
      console.log('✅ 工作地点参数成功:', { 
        resultCount: worklocationResult?.length || 0,
        sampleData: worklocationResult?.[0] ? {
          id: worklocationResult[0].id,
          leadid: worklocationResult[0].leadid,
          worklocation: worklocationResult[0].worklocation
        } : null
      });
    }
    
    // 测试3：检查函数是否存在
    console.log('\n📋 测试3：检查函数是否存在');
    
    const { data: functionCheck, error: functionError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_name', 'filter_followups')
      .eq('routine_schema', 'public');
    
    if (functionError) {
      console.error('❌ 函数检查失败:', functionError);
    } else {
      console.log('✅ 函数检查结果:', functionCheck);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

simpleDebugTest().then(() => {
  console.log('\n🏁 简化调试测试完成');
}).catch(error => {
  console.error('❌ 简化调试测试失败:', error);
});
