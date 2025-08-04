// 快速诊断脚本 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🔍 开始快速诊断...');

// 1. 检查环境变量
console.log('📋 环境变量检查:');
console.log('- VITE_SUPABASE_URL:', !!import.meta.env.VITE_SUPABASE_URL);
console.log('- VITE_SUPABASE_ANON_KEY:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

// 2. 检查Supabase客户端
console.log('🔧 Supabase客户端检查:');
console.log('- supabase对象:', !!window.supabase);
console.log('- supabase.auth:', !!window.supabase?.auth);

// 3. 测试基本查询
async function runDiagnosis() {
  try {
    console.log('🧪 开始测试查询...');
    
    // 测试1: 用户认证
    console.log('👤 检查用户认证...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('- 用户认证状态:', { user: !!user, error: authError });
    
    // 测试2: 基本连接
    console.log('🔗 测试基本连接...');
    const { data: connData, error: connError } = await supabase
      .from('followups')
      .select('count')
      .limit(1);
    console.log('- 基本连接:', { success: !connError, error: connError });
    
    // 测试3: 简单查询
    console.log('📊 测试简单查询...');
    const { data: simpleData, error: simpleError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .limit(3);
    console.log('- 简单查询:', { 
      success: !simpleError, 
      dataCount: simpleData?.length || 0,
      error: simpleError 
    });
    
    // 测试4: 条件查询
    console.log('🔍 测试条件查询...');
    const { data: condData, error: condError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .not('moveintime', 'is', null)
      .limit(3);
    console.log('- 条件查询:', { 
      success: !condError, 
      dataCount: condData?.length || 0,
      error: condError 
    });
    
    // 测试5: 日期范围查询
    console.log('📅 测试日期范围查询...');
    const startDate = '2025-01-01 00:00:00';
    const endDate = '2025-01-31 23:59:59';
    const { data: dateData, error: dateError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .not('moveintime', 'is', null)
      .gte('moveintime', startDate)
      .lte('moveintime', endDate);
    console.log('- 日期范围查询:', { 
      success: !dateError, 
      dataCount: dateData?.length || 0,
      error: dateError 
    });
    
    // 测试6: 完整查询（模拟日历视图）
    console.log('🎯 测试完整查询...');
          const { data: fullData, error: fullError } = await supabase
        .from('followups')
        .select(`
          id,
          leadid,
          followupstage,
          customerprofile,
          worklocation,
          userbudget,
          moveintime,
          userrating,
          scheduledcommunity,
          interviewsales_user_id,
          users_profile!followups_interviewsales_user_id_fkey(nickname)
        `)
        .not('moveintime', 'is', null)
        .limit(5);
    console.log('- 完整查询:', { 
      success: !fullError, 
      dataCount: fullData?.length || 0,
      error: fullError 
    });
    
    // 总结
    console.log('📋 诊断总结:');
    console.log('- 环境变量:', !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    console.log('- 用户认证:', !!user);
    console.log('- 基本连接:', !connError);
    console.log('- 简单查询:', !simpleError);
    console.log('- 条件查询:', !condError);
    console.log('- 日期范围查询:', !dateError);
    console.log('- 完整查询:', !fullError);
    
    if (fullError) {
      console.error('❌ 发现问题:', fullError);
      console.log('💡 建议:');
      console.log('1. 检查用户权限');
      console.log('2. 检查数据库连接');
      console.log('3. 检查RLS策略');
      console.log('4. 访问 /debug-calendar 页面进行详细测试');
    } else {
      console.log('✅ 所有测试通过！');
    }
    
  } catch (error) {
    console.error('❌ 诊断过程中出现错误:', error);
  }
}

// 执行诊断
runDiagnosis(); 