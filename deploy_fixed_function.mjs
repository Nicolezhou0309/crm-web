// 部署修复后的 filter_followups 函数
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

console.log('🔗 连接信息:', { 
  url: supabaseUrl, 
  serviceRoleKey: serviceRoleKey ? 'SET' : 'NOT SET' 
});

if (!serviceRoleKey) {
  console.error('❌ 服务角色密钥未设置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deployFixedFunction() {
  console.log('🚀 开始部署修复后的 filter_followups 函数...');
  
  try {
    // 读取修复后的函数SQL
    const functionSql = readFileSync(join(__dirname, 'fix_filter_followups_function.sql'), 'utf8');
    
    console.log('📝 函数SQL长度:', functionSql.length, '字符');
    
    // 执行SQL创建函数
    const { data, error } = await supabase.rpc('exec_sql', { sql: functionSql });
    
    if (error) {
      console.error('❌ 函数部署失败:', error);
      
      // 尝试使用其他方法
      console.log('🔄 尝试使用 sql 方法...');
      const { data: sqlData, error: sqlError } = await supabase.sql(functionSql);
      
      if (sqlError) {
        console.error('❌ SQL方法也失败:', sqlError);
        return;
      } else {
        console.log('✅ 函数部署成功 (使用sql方法)');
      }
    } else {
      console.log('✅ 函数部署成功 (使用exec_sql)');
    }
    
    // 验证函数是否部署成功
    console.log('\n🔍 验证函数部署...');
    const { data: testResult, error: testError } = await supabase.rpc('filter_followups', {
      p_worklocation: ['联航路'],
      p_limit: 5,
      p_offset: 0
    });
    
    if (testError) {
      console.error('❌ 函数测试失败:', testError);
    } else {
      console.log('✅ 函数测试成功:', { 
        resultCount: testResult?.length || 0,
        sampleData: testResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
  } catch (error) {
    console.error('❌ 部署过程中发生错误:', error);
  }
}

// 运行部署
deployFixedFunction().then(() => {
  console.log('\n🏁 函数部署完成');
}).catch(error => {
  console.error('❌ 函数部署失败:', error);
});
