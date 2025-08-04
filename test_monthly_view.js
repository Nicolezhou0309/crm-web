// 测试默认显示本月功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试默认显示本月功能...');

async function testMonthlyView() {
  try {
    const now = dayjs();
    const startOfMonth = now.startOf('month');
    const endOfMonth = now.endOf('month');
    
    console.log('📅 当前月份信息:', {
      currentMonth: now.format('YYYY年MM月'),
      startDate: startOfMonth.format('YYYY-MM-DD'),
      endDate: endOfMonth.format('YYYY-MM-DD'),
      daysInMonth: endOfMonth.date()
    });
    
    // 测试查询本月数据
    console.log('🔍 查询本月数据...');
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
        users_profile!followups_interviewsales_user_id_fkey(nickname)
      `)
      .not('moveintime', 'is', null)
      .gte('moveintime', startOfMonth.format('YYYY-MM-DD 00:00:00'))
      .lte('moveintime', endOfMonth.format('YYYY-MM-DD 23:59:59'));
    
    if (error) {
      console.error('❌ 查询本月数据失败:', error);
      return;
    }
    
    console.log('✅ 本月数据查询成功！');
    console.log('📊 本月数据统计:', {
      totalRecords: data?.length || 0,
      dateRange: `${startOfMonth.format('MM-DD')} 至 ${endOfMonth.format('MM-DD')}`
    });
    
    // 按日期分组统计
    const dateGroups = {};
    data?.forEach(record => {
      const date = dayjs(record.moveintime).format('YYYY-MM-DD');
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(record);
    });
    
    console.log('📅 按日期分组统计:', {
      totalDays: Object.keys(dateGroups).length,
      dateGroups: Object.keys(dateGroups).map(date => ({
        date,
        count: dateGroups[date].length,
        records: dateGroups[date].map(r => r.leadid)
      }))
    });
    
    // 按跟进阶段统计
    const stageGroups = {};
    data?.forEach(record => {
      const stage = record.followupstage;
      if (!stageGroups[stage]) {
        stageGroups[stage] = [];
      }
      stageGroups[stage].push(record);
    });
    
    console.log('🏷️ 按跟进阶段统计:', Object.keys(stageGroups).map(stage => ({
      stage,
      count: stageGroups[stage].length
    })));
    
    console.log('🎉 本月视图功能正常！');
    console.log('💡 提示: 页面默认显示本月数据，可以通过过滤器调整查看范围。');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testMonthlyView(); 