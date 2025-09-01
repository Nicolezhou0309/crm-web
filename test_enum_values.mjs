// 测试枚举值
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

async function testEnumValues() {
  console.log('🧪 开始测试枚举值...');
  
  try {
    // 测试1：获取followupstage枚举值
    console.log('\n📋 测试1：获取followupstage枚举值');
    try {
      const { data: enumResult, error: enumError } = await supabase.rpc('get_enum_values', {
        enum_name: 'followupstage'
      });
      
      if (enumError) {
        console.error('❌ 获取followupstage枚举值失败:', enumError);
      } else {
        console.log('✅ followupstage枚举值:', enumResult);
      }
    } catch (err) {
      console.log('❌ get_enum_values函数不存在，尝试其他方法');
    }
    
    // 测试2：直接从数据库查询枚举值
    console.log('\n📋 测试2：直接从数据库查询枚举值');
    try {
      const { data: directEnum, error: directEnumError } = await supabase
        .from('followups')
        .select('followupstage')
        .not('followupstage', 'is', null)
        .limit(10);
      
      if (directEnumError) {
        console.error('❌ 直接查询followupstage失败:', directEnumError);
      } else {
        const uniqueValues = [...new Set(directEnum.map(item => item.followupstage))];
        console.log('✅ 数据库中的followupstage值:', uniqueValues);
      }
    } catch (err) {
      console.log('❌ 直接查询失败:', err.message);
    }
    
    // 测试3：测试不同的参数组合
    console.log('\n📋 测试3：测试不同的参数组合');
    
    // 只传分页参数，看看是否还有ANY错误
    const { data: paginationResult, error: paginationError } = await supabase.rpc('filter_followups', {
      p_limit: 5,
      p_offset: 0
    });
    
    if (paginationError) {
      console.error('❌ 分页参数测试失败:', paginationError);
      console.log('💡 如果还是42809错误，说明ANY操作符问题仍然存在');
    } else {
      console.log('✅ 分页参数测试成功:', { 
        resultCount: paginationResult?.length || 0
      });
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testEnumValues().then(() => {
  console.log('\n🏁 枚举值测试完成');
}).catch(error => {
  console.error('❌ 枚举值测试失败:', error);
});
