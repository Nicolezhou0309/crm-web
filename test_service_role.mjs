// 使用服务角色密钥测试
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

async function testWithServiceRole() {
  console.log('🧪 开始服务角色测试...');
  
  try {
    // 测试1：直接查询followups表
    console.log('\n📋 测试1：直接查询followups表');
    const { data: followups, error: followupsError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation, created_at')
      .limit(5);
    
    if (followupsError) {
      console.error('❌ followups表查询失败:', followupsError);
    } else {
      console.log('✅ followups表查询成功:', { 
        recordCount: followups?.length || 0,
        sampleData: followups?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试2：查询联航路数据
    console.log('\n📋 测试2：查询联航路数据');
    const { data: lianhanglu, error: lianhangluError } = await supabase
      .from('followups')
      .select('id, leadid, worklocation, created_at')
      .eq('worklocation', '联航路')
      .limit(5);
    
    if (lianhangluError) {
      console.error('❌ 联航路查询失败:', lianhangluError);
    } else {
      console.log('✅ 联航路查询成功:', { 
        resultCount: lianhanglu?.length || 0,
        sampleData: lianhanglu?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试3：使用RPC函数
    console.log('\n📋 测试3：使用RPC函数');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('filter_followups', {
      p_worklocation: ['联航路'],
      p_limit: 5,
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
    });
    
    if (rpcError) {
      console.error('❌ RPC调用失败:', rpcError);
    } else {
      console.log('✅ RPC调用成功:', { 
        resultCount: rpcResult?.length || 0,
        sampleData: rpcResult?.slice(0, 2)?.map(item => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation
        }))
      });
    }
    
    // 测试4：统计信息
    console.log('\n📋 测试4：统计信息');
    const { data: stats, error: statsError } = await supabase
      .from('followups')
      .select('worklocation')
      .not('worklocation', 'is', null);
    
    if (statsError) {
      console.error('❌ 统计查询失败:', statsError);
    } else {
      const worklocationCounts = {};
      stats?.forEach(item => {
        worklocationCounts[item.worklocation] = (worklocationCounts[item.worklocation] || 0) + 1;
      });
      
      console.log('✅ 统计查询成功:', { 
        totalWithWorklocation: stats?.length || 0,
        uniqueWorklocations: Object.keys(worklocationCounts).length,
        topWorklocations: Object.entries(worklocationCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([location, count]) => `${location}: ${count}`)
      });
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testWithServiceRole().then(() => {
  console.log('\n🏁 服务角色测试完成');
}).catch(error => {
  console.error('❌ 服务角色测试失败:', error);
});
