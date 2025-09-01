// 测试函数默认参数值
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

async function testFunctionDefaults() {
  console.log('🧪 开始测试函数默认参数值...');
  
  try {
    // 测试1：尝试传递所有数组参数为NULL
    console.log('\n📋 测试1：传递所有数组参数为NULL');
    
    try {
      const { data: nullArrayResult, error: nullArrayError } = await supabase
        .rpc('filter_followups', {
          p_customerprofile: null,
          p_followupresult: null,
          p_followupstage: null,
          p_interviewsales_user_id: null,
          p_leadid: null,
          p_leadtype: null,
          p_majorcategory: null,
          p_moveintime_not_null: null,
          p_scheduledcommunity: null,
          p_showingsales_user: null,
          p_source: null,
          p_userbudget: null,
          p_userrating: null,
          p_wechat: null,
          p_worklocation: null,
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
          p_limit: 1
        });
      
      if (nullArrayError) {
        console.error('❌ NULL数组参数测试失败:', nullArrayError);
      } else {
        console.log('✅ NULL数组参数测试成功:', { 
          resultCount: nullArrayResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ NULL数组参数测试异常:', error);
    }
    
    // 测试2：尝试传递所有数组参数为空数组
    console.log('\n📋 测试2：传递所有数组参数为空数组');
    
    try {
      const { data: emptyArrayResult, error: emptyArrayError } = await supabase
        .rpc('filter_followups', {
          p_customerprofile: [],
          p_followupresult: [],
          p_followupstage: [],
          p_interviewsales_user_id: [],
          p_leadid: [],
          p_leadtype: [],
          p_majorcategory: [],
          p_moveintime_not_null: [],
          p_scheduledcommunity: [],
          p_showingsales_user: [],
          p_source: [],
          p_userbudget: [],
          p_userrating: [],
          p_wechat: [],
          p_worklocation: [],
          p_phone: [],
          p_qq: [],
          p_location: [],
          p_budget: [],
          p_douyinid: [],
          p_douyin_accountname: [],
          p_staffname: [],
          p_redbookid: [],
          p_area: [],
          p_notelink: [],
          p_campaignid: [],
          p_campaignname: [],
          p_unitid: [],
          p_unitname: [],
          p_creativedid: [],
          p_creativename: [],
          p_traffictype: [],
          p_interactiontype: [],
          p_douyinleadid: [],
          p_leadstatus: [],
          p_limit: 1
        });
      
      if (emptyArrayError) {
        console.error('❌ 空数组参数测试失败:', emptyArrayError);
      } else {
        console.log('✅ 空数组参数测试成功:', { 
          resultCount: emptyArrayResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ 空数组参数测试异常:', error);
    }
    
    // 测试3：尝试传递所有数组参数为undefined
    console.log('\n📋 测试3：传递所有数组参数为undefined');
    
    try {
      const { data: undefinedArrayResult, error: undefinedArrayError } = await supabase
        .rpc('filter_followups', {
          p_limit: 1
        });
      
      if (undefinedArrayError) {
        console.error('❌ undefined数组参数测试失败:', undefinedArrayError);
      } else {
        console.log('✅ undefined数组参数测试成功:', { 
          resultCount: undefinedArrayResult?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ undefined数组参数测试异常:', error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testFunctionDefaults().then(() => {
  console.log('\n🏁 函数默认参数值测试完成');
}).catch(error => {
  console.error('❌ 函数默认参数值测试失败:', error);
});
