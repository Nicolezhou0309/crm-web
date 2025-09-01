// 详细的RPC调试测试
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

async function debugRPC() {
  console.log('🧪 开始RPC调试测试...');
  
  try {
    // 测试1：最小参数测试
    console.log('\n📋 测试1：最小参数测试');
    const minParams = {
      p_limit: 5,
      p_offset: 0
    };
    
    console.log('🔍 最小参数:', JSON.stringify(minParams, null, 2));
    
    const { data: minResult, error: minError } = await supabase.rpc('filter_followups', minParams);
    
    if (minError) {
      console.error('❌ 最小参数测试失败:', minError);
    } else {
      console.log('✅ 最小参数测试成功:', { 
        resultCount: minResult?.length || 0,
        sampleData: minResult?.slice(0, 2)
      });
    }
    
    // 测试2：只传工作地点参数
    console.log('\n📋 测试2：只传工作地点参数');
    const worklocationParams = {
      p_worklocation: ['联航路'],
      p_limit: 5,
      p_offset: 0
    };
    
    console.log('🔍 工作地点参数:', JSON.stringify(worklocationParams, null, 2));
    
    const { data: workResult, error: workError } = await supabase.rpc('filter_followups', worklocationParams);
    
    if (workError) {
      console.error('❌ 工作地点参数测试失败:', workError);
    } else {
      console.log('✅ 工作地点参数测试成功:', { 
        resultCount: workResult?.length || 0,
        sampleData: workResult?.slice(0, 2)
      });
    }
    
    // 测试3：完整参数测试（所有参数为null）
    console.log('\n📋 测试3：完整参数测试（所有参数为null）');
    const fullParams = {
      p_created_at_end: null,
      p_created_at_start: null,
      p_customerprofile: null,
      p_followupresult: null,
      p_followupstage: null,
      p_interviewsales_user_id: null,
      p_leadid: null,
      p_leadtype: null,
      p_limit: 5,
      p_majorcategory: null,
      p_moveintime_end: null,
      p_moveintime_start: null,
      p_moveintime_not_null: null,
      p_offset: 0,
      p_remark: null,
      p_scheduledcommunity: null,
      p_showingsales_user: null,
      p_source: null,
      p_userbudget: null,
      p_userbudget_min: null,
      p_userbudget_max: null,
      p_userrating: null,
      p_wechat: null,
      p_worklocation: ['联航路'],
      p_phone: null,
      p_qq: null,
      p_location: null,
      p_budget: null,
      p_douyinid: null,
      p_douyin_accountname: null,
      p_staffname: null,
      p_redbookid: null,
      p_area: null,
      p_notelink: null,
      p_campaignid: null,
      p_campaignname: null,
      p_unitid: null,
      p_unitname: null,
      p_creativedid: null,
      p_creativename: null,
      p_traffictype: null,
      p_interactiontype: null,
      p_douyinleadid: null,
      p_leadstatus: null,
      p_keyword: null
    };
    
    console.log('🔍 完整参数数量:', Object.keys(fullParams).length);
    
    const { data: fullResult, error: fullError } = await supabase.rpc('filter_followups', fullParams);
    
    if (fullError) {
      console.error('❌ 完整参数测试失败:', fullError);
    } else {
      console.log('✅ 完整参数测试成功:', { 
        resultCount: fullResult?.length || 0,
        sampleData: fullResult?.slice(0, 2)
      });
    }
    
    // 测试4：检查函数是否存在
    console.log('\n📋 测试4：检查函数是否存在');
    try {
      const { data: funcCheck, error: funcError } = await supabase
        .from('pg_proc')
        .select('proname, proargtypes')
        .eq('proname', 'filter_followups')
        .limit(1);
      
      if (funcError) {
        console.log('❌ 函数检查失败:', funcError.message);
      } else {
        console.log('✅ 函数检查成功:', { 
          functions: funcCheck || [],
          count: funcCheck?.length || 0
        });
      }
    } catch (err) {
      console.log('❌ 函数检查异常:', err.message);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
debugRPC().then(() => {
  console.log('\n🏁 RPC调试测试完成');
}).catch(error => {
  console.error('❌ RPC调试测试失败:', error);
});
