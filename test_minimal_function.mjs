// 最小化函数测试
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

async function minimalFunctionTest() {
  console.log('🧪 开始最小化函数测试...');
  
  try {
    // 测试1：检查函数是否存在
    console.log('\n📋 测试1：检查函数是否存在');
    
    const { data: functionExists, error: functionExistsError } = await supabase
      .from('pg_proc')
      .select('proname, prosrc')
      .eq('proname', 'filter_followups')
      .eq('pronamespace', 2200); // public schema
    
    if (functionExistsError) {
      console.error('❌ 函数存在性检查失败:', functionExistsError);
    } else {
      console.log('✅ 函数存在性检查成功:', functionExists?.length || 0, '个函数');
      if (functionExists && functionExists.length > 0) {
        console.log('🔍 函数源码片段:', functionExists[0].prosrc?.substring(0, 200));
      }
    }
    
    // 测试2：尝试直接SQL调用函数
    console.log('\n📋 测试2：直接SQL调用函数');
    
    try {
      const { data: sqlResult, error: sqlError } = await supabase
        .rpc('exec_sql', {
          sql_query: 'SELECT * FROM filter_followups() LIMIT 1'
        });
      
      if (sqlError) {
        console.error('❌ 直接SQL调用失败:', sqlError);
      } else {
        console.log('✅ 直接SQL调用成功:', sqlResult);
      }
    } catch (error) {
      console.error('❌ 直接SQL调用异常:', error);
    }
    
    // 测试3：检查函数参数
    console.log('\n📋 测试3：检查函数参数');
    
    try {
      const { data: functionArgs, error: functionArgsError } = await supabase
        .from('pg_proc')
        .select('proname, proargtypes, proargnames, proargdefaults')
        .eq('proname', 'filter_followups');
      
      if (functionArgsError) {
        console.error('❌ 函数参数检查失败:', functionArgsError);
      } else {
        console.log('✅ 函数参数检查成功:', functionArgs);
      }
    } catch (error) {
      console.error('❌ 函数参数检查异常:', error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

minimalFunctionTest().then(() => {
  console.log('\n🏁 最小化函数测试完成');
}).catch(error => {
  console.error('❌ 最小化函数测试失败:', error);
});
