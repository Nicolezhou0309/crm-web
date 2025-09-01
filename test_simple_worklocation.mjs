// 简单的工作地点筛选测试
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

async function testSimpleWorklocation() {
  console.log('🧪 开始简单工作地点测试...');
  
  try {
    // 测试1：直接SQL查询模拟
    console.log('\n📋 测试1：直接SQL查询模拟');
    
    // 模拟函数中的WHERE条件
    const { data: directResult, error: directError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation, created_at')
      .or('worklocation.eq.联航路,worklocation.eq.东方体育中心,worklocation.eq.人民广场')
      .limit(5);
    
    if (directError) {
      console.error('❌ 直接SQL查询失败:', directError);
    } else {
      console.log('✅ 直接SQL查询成功:', { 
        resultCount: directResult?.length || 0,
        sampleData: directResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试2：使用IN操作符
    console.log('\n📋 测试2：使用IN操作符');
    
    const { data: inResult, error: inError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation, created_at')
      .in('worklocation', ['联航路', '东方体育中心', '人民广场'])
      .limit(5);
    
    if (inError) {
      console.error('❌ IN操作符查询失败:', inError);
    } else {
      console.log('✅ IN操作符查询成功:', { 
        resultCount: inResult?.length || 0,
        sampleData: inResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试3：检查数据类型
    console.log('\n📋 测试3：检查数据类型');
    
    const { data: typeResult, error: typeError } = await supabase
      .from('followups')
      .select('worklocation')
      .not('worklocation', 'is', null)
      .limit(10);
    
    if (typeError) {
      console.error('❌ 数据类型检查失败:', typeError);
    } else {
      const uniqueTypes = new Set();
      typeResult?.forEach(item => {
        if (item.worklocation) {
          uniqueTypes.add(typeof item.worklocation);
        }
      });
      
      console.log('✅ 数据类型检查成功:', { 
        sampleData: typeResult?.slice(0, 5)?.map(item => ({
          worklocation: item.worklocation,
          type: typeof item.worklocation,
          length: item.worklocation ? item.worklocation.length : 'N/A'
        })),
        uniqueTypes: Array.from(uniqueTypes)
      });
    }
    
    // 测试4：验证数组参数
    console.log('\n📋 测试4：验证数组参数');
    
    const testArray = ['联航路', '东方体育中心'];
    console.log('🔍 测试数组:', {
      array: testArray,
      type: typeof testArray,
      isArray: Array.isArray(testArray),
      length: testArray.length,
      firstElement: testArray[0],
      firstElementType: typeof testArray[0]
    });
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSimpleWorklocation().then(() => {
  console.log('\n🏁 简单工作地点测试完成');
}).catch(error => {
  console.error('❌ 简单工作地点测试失败:', error);
});
