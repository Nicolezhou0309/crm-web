// 测试修复后的查询 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🔧 测试修复后的查询...');

async function testFixedQuery() {
  try {
    console.log('📊 测试修复后的完整查询...');
    
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
      .limit(5);
    
    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }
    
    console.log('✅ 查询成功！');
    console.log('📊 数据条数:', data?.length || 0);
    console.log('📋 数据示例:', data);
    
    // 检查数据结构
    if (data && data.length > 0) {
      const firstRecord = data[0];
      console.log('🔍 第一条记录结构:', {
        id: firstRecord.id,
        leadid: firstRecord.leadid,
        followupstage: firstRecord.followupstage,
        moveintime: firstRecord.moveintime,
        interviewsales_user_id: firstRecord.interviewsales_user_id,
        users_profile: firstRecord.users_profile
      });
    }
    
    console.log('🎉 修复成功！现在可以正常访问日历视图了。');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testFixedQuery(); 