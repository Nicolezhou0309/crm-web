// 测试修复后的 filter_followups 函数
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

async function testFilterFollowupsFunction() {
  console.log('🧪 开始测试修复后的 filter_followups 函数...');
  
  try {
    // 测试1：使用工作地点筛选
    console.log('\n📋 测试1：使用工作地点筛选');
    
    const { data: worklocationResult, error: worklocationError } = await supabase
      .rpc('filter_followups', {
        p_worklocation: ['联航路', '东方体育中心'],
        p_limit: 5
      });
    
    if (worklocationError) {
      console.error('❌ 工作地点筛选测试失败:', worklocationError);
    } else {
      console.log('✅ 工作地点筛选测试成功:', { 
        resultCount: worklocationResult?.length || 0,
        sampleData: worklocationResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试2：使用多个筛选条件
    console.log('\n📋 测试2：使用多个筛选条件');
    
    const { data: multiFilterResult, error: multiFilterError } = await supabase
      .rpc('filter_followups', {
        p_worklocation: ['联航路'],
        p_majorcategory: ['已预约'],
        p_limit: 3
      });
    
    if (multiFilterError) {
      console.error('❌ 多条件筛选测试失败:', multiFilterError);
    } else {
      console.log('✅ 多条件筛选测试成功:', { 
        resultCount: multiFilterResult?.length || 0,
        sampleData: multiFilterResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation,
          majorcategory: item.majorcategory
        }))
      });
    }
    
    // 测试3：使用关键词搜索
    console.log('\n📋 测试3：使用关键词搜索');
    
    const { data: keywordResult, error: keywordError } = await supabase
      .rpc('filter_followups', {
        p_keyword: '联航路',
        p_limit: 3
      });
    
    if (keywordError) {
      console.error('❌ 关键词搜索测试失败:', keywordError);
    } else {
      console.log('✅ 关键词搜索测试成功:', { 
        resultCount: keywordResult?.length || 0,
        sampleData: keywordResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试4：检查返回字段完整性
    console.log('\n📋 测试4：检查返回字段完整性');
    
    if (worklocationResult && worklocationResult.length > 0) {
      const firstRecord = worklocationResult[0];
      const expectedFields = [
        'id', 'leadid', 'lead_uuid', 'leadtype', 'followupstage', 'followupstage_name',
        'customerprofile', 'customerprofile_name', 'worklocation', 'worklocation_id',
        'userbudget', 'userbudget_id', 'moveintime', 'scheduletime', 'created_at',
        'updated_at', 'userrating', 'userrating_name', 'majorcategory', 'majorcategory_id',
        'followupresult', 'followupresult_id', 'scheduledcommunity', 'scheduledcommunity_name',
        'phone', 'wechat', 'source', 'source_name', 'remark', 'interviewsales_user_id',
        'interviewsales_user_name', 'showingsales_user_id', 'showingsales_user_name',
        'qq', 'location', 'budget', 'douyinid', 'douyin_accountname', 'staffname',
        'redbookid', 'area', 'notelink', 'campaignid', 'campaignname', 'unitid',
        'unitname', 'creativedid', 'creativename', 'traffictype', 'interactiontype',
        'douyinleadid', 'leadstatus', 'invalid', 'extended_data', 'total_count'
      ];
      
      const missingFields = expectedFields.filter(field => !(field in firstRecord));
      
      if (missingFields.length === 0) {
        console.log('✅ 返回字段完整性检查通过');
      } else {
        console.log('⚠️ 返回字段缺失:', missingFields);
      }
      
      console.log('🔍 第一条记录示例:', {
        id: firstRecord.id,
        leadid: firstRecord.leadid,
        worklocation: firstRecord.worklocation,
        total_count: firstRecord.total_count
      });
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testFilterFollowupsFunction().then(() => {
  console.log('\n🏁 filter_followups 函数测试完成');
}).catch(error => {
  console.error('❌ filter_followups 函数测试失败:', error);
});
