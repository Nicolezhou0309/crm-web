// 简单数据查询测试
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

// 配置Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://47.123.26.25:8000';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSimpleQueries() {
  console.log('🧪 开始简单查询测试...');
  
  try {
    // 测试1：检查所有表
    console.log('\n📋 测试1：检查所有表');
    const { data: tables, error: tablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename, schemaname')
      .eq('schemaname', 'public')
      .limit(10);
    
    if (tablesError) {
      console.error('❌ 表检查失败:', tablesError);
    } else {
      console.log('✅ 表检查成功:', { tables: tables || [] });
    }
    
    // 测试2：尝试不同的表名
    console.log('\n📋 测试2：尝试不同的表名');
    const tableNames = ['followups', 'followup', 'follow_ups', 'leads', 'lead'];
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName} 表访问失败:`, error.message);
        } else {
          console.log(`✅ ${tableName} 表访问成功:`, { recordCount: data?.length || 0 });
          if (data && data.length > 0) {
            console.log(`   📝 样本数据:`, data[0]);
          }
        }
      } catch (err) {
        console.log(`❌ ${tableName} 表访问异常:`, err.message);
      }
    }
    
    // 测试3：检查用户权限
    console.log('\n📋 测试3：检查用户权限');
    const { data: user, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('❌ 用户权限检查失败:', userError.message);
    } else {
      console.log('✅ 用户权限检查成功:', { 
        userId: user?.user?.id,
        email: user?.user?.email,
        role: user?.user?.role
      });
    }
    
    // 测试4：尝试RPC调用
    console.log('\n📋 测试4：尝试RPC调用');
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('filter_followups', {
        p_worklocation: ['联航路'],
        p_limit: 5,
        p_offset: 0
      });
      
      if (rpcError) {
        console.log('❌ RPC调用失败:', rpcError.message);
      } else {
        console.log('✅ RPC调用成功:', { 
          resultCount: rpcResult?.length || 0,
          sampleData: rpcResult?.slice(0, 2)
        });
      }
    } catch (rpcErr) {
      console.log('❌ RPC调用异常:', rpcErr.message);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSimpleQueries().then(() => {
  console.log('\n🏁 简单查询测试完成');
}).catch(error => {
  console.error('❌ 简单查询测试失败:', error);
});
