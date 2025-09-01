// 测试数组参数处理
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

async function testArrayHandling() {
  console.log('🧪 开始测试数组参数处理...');
  
  try {
    // 测试1：传递空数组而不是NULL
    console.log('\n📋 测试1：传递空数组');
    
    const { data: emptyArrayResult, error: emptyArrayError } = await supabase
      .rpc('filter_followups', {
        p_worklocation: [],
        p_limit: 1
      });
    
    if (emptyArrayError) {
      console.error('❌ 空数组测试失败:', emptyArrayError);
    } else {
      console.log('✅ 空数组测试成功:', { 
        resultCount: emptyArrayResult?.length || 0
      });
    }
    
    // 测试2：传递所有数组参数为空数组
    console.log('\n📋 测试2：传递所有数组参数为空数组');
    
    const { data: allEmptyResult, error: allEmptyError } = await supabase
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
    
    if (allEmptyError) {
      console.error('❌ 所有空数组测试失败:', allEmptyError);
    } else {
      console.log('✅ 所有空数组测试成功:', { 
        resultCount: allEmptyResult?.length || 0
      });
    }
    
    // 测试3：直接SQL查询验证数据
    console.log('\n📋 测试3：直接SQL查询验证');
    
    const { data: directResult, error: directError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation')
      .limit(1);
    
    if (directError) {
      console.error('❌ 直接查询失败:', directError);
    } else {
      console.log('✅ 直接查询成功:', directResult);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testArrayHandling().then(() => {
  console.log('\n🏁 数组参数处理测试完成');
}).catch(error => {
  console.error('❌ 数组参数处理测试失败:', error);
});
