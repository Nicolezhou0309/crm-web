// 测试工作地点筛选功能
// 验证前端参数是否正确传递给数据库函数

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
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your_supabase_url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your_supabase_key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWorklocationFilter() {
  console.log('🧪 开始测试工作地点筛选功能...');
  
  try {
    // 测试1：使用联航路筛选
    console.log('\n📋 测试1：筛选联航路');
    const testParams1 = {
      p_worklocation: ['联航路'],
      p_limit: 10,
      p_offset: 0,
      // 确保所有必需参数都有默认值
      p_created_at_end: null,
      p_created_at_start: null,
      p_customerprofile: null,
      p_followupresult: null,
      p_followupstage: null,
      p_interviewsales_user_id: null,
      p_leadid: null,
      p_leadtype: null,
      p_majorcategory: null,
      p_moveintime_end: null,
      p_moveintime_start: null,
      p_moveintime_not_null: null,
      p_remark: null,
      p_scheduledcommunity: null,
      p_showingsales_user: null,
      p_source: null,
      p_userbudget: null,
      p_userbudget_min: null,
      p_userbudget_max: null,
      p_userrating: null,
      p_wechat: null,
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
    
    console.log('🔍 调用参数:', JSON.stringify(testParams1, null, 2));
    
    const { data: result1, error: error1 } = await supabase.rpc('filter_followups', testParams1);
    
    if (error1) {
      console.error('❌ 测试1失败:', error1);
    } else {
      console.log('✅ 测试1成功:', {
        resultCount: result1?.length || 0,
        sampleData: result1?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试2：使用多个工作地点筛选
    console.log('\n📋 测试2：筛选多个工作地点');
    const testParams2 = {
      ...testParams1,
      p_worklocation: ['联航路', '东方体育中心', '人民广场']
    };
    
    const { data: result2, error: error2 } = await supabase.rpc('filter_followups', testParams2);
    
    if (error2) {
      console.error('❌ 测试2失败:', error2);
    } else {
      console.log('✅ 测试2成功:', {
        resultCount: result2?.length || 0,
        sampleData: result2?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试3：空筛选条件
    console.log('\n📋 测试3：空筛选条件');
    const testParams3 = {
      ...testParams1,
      p_worklocation: null
    };
    
    const { data: result3, error: error3 } = await supabase.rpc('filter_followups', testParams3);
    
    if (error3) {
      console.error('❌ 测试3失败:', error3);
    } else {
      console.log('✅ 测试3成功:', {
        resultCount: result3?.length || 0,
        sampleData: result3?.slice(0, 2)?.map(item => ({
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
testWorklocationFilter().then(() => {
  console.log('\n🏁 测试完成');
}).catch(error => {
  console.error('❌ 测试失败:', error);
});
