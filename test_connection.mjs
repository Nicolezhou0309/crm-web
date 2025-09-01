// 测试Supabase连接
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

console.log('🔗 连接信息:', { url: supabaseUrl, key: supabaseKey ? 'SET' : 'NOT SET' });

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🧪 开始测试连接...');
  
  try {
    // 测试1：基本连接
    console.log('\n📋 测试1：基本连接');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (tablesError) {
      console.error('❌ 基本连接失败:', tablesError);
    } else {
      console.log('✅ 基本连接成功:', { tableCount: tables?.length || 0 });
    }
    
    // 测试2：检查followups表
    console.log('\n📋 测试2：检查followups表');
    const { data: followups, error: followupsError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation')
      .limit(1);
    
    if (followupsError) {
      console.error('❌ followups表访问失败:', followupsError);
    } else {
      console.log('✅ followups表访问成功:', { recordCount: followups?.length || 0 });
    }
    
    // 测试3：检查函数是否存在
    console.log('\n📋 测试3：检查filter_followups函数');
    const { data: functions, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'filter_followups');
    
    if (functionsError) {
      console.error('❌ 函数检查失败:', functionsError);
    } else {
      console.log('✅ 函数检查成功:', { functions: functions || [] });
    }
    
    // 测试4：直接查询联航路数据
    console.log('\n📋 测试4：直接查询联航路数据');
    const { data: directQuery, error: directError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation, created_at')
      .eq('worklocation', '联航路')
      .limit(5);
    
    if (directError) {
      console.error('❌ 直接查询失败:', directError);
    } else {
      console.log('✅ 直接查询成功:', { 
        resultCount: directQuery?.length || 0,
        sampleData: directQuery?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testConnection().then(() => {
  console.log('\n🏁 连接测试完成');
}).catch(error => {
  console.error('❌ 连接测试失败:', error);
});
