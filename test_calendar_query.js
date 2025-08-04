// 在浏览器控制台中运行的测试脚本
// 复制以下代码到浏览器控制台执行

async function testCalendarQuery() {
  console.log('🔍 测试日历视图数据查询...');
  
  try {
    // 测试基本查询
    const { data, error } = await supabase
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
        users_profile!followups_interviewsales_user_id_fkey(name)
      `)
      .not('moveintime', 'is', null)
      .limit(5);
    
    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }
    
    console.log('✅ 查询成功，数据:', data);
    
    // 测试日期范围查询
    const startDate = '2025-01-01 00:00:00';
    const endDate = '2025-01-31 23:59:59';
    
    const { data: rangeData, error: rangeError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .not('moveintime', 'is', null)
      .gte('moveintime', startDate)
      .lte('moveintime', endDate);
    
    if (rangeError) {
      console.error('❌ 日期范围查询失败:', rangeError);
      return;
    }
    
    console.log('✅ 日期范围查询成功，数据:', rangeData);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 执行测试
testCalendarQuery(); 