// 测试移除客户画像筛选后的功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试移除客户画像筛选后的功能...');

async function testNoProfileFilter() {
  try {
    console.log('📊 测试当前过滤功能...');
    
    // 测试1: 基本查询（无过滤）
    console.log('🔍 测试1: 基本查询（无过滤）');
    const { data: basicData, error: basicError } = await supabase
      .from('followups')
      .select('id, leadid, followupstage, customerprofile, moveintime')
      .not('moveintime', 'is', null)
      .limit(5);
    
    if (basicError) {
      console.error('❌ 基本查询失败:', basicError);
      return;
    }
    
    console.log('✅ 基本查询成功，数据条数:', basicData?.length || 0);
    
    // 测试2: 跟进阶段过滤
    console.log('🔍 测试2: 跟进阶段过滤');
    const { data: stageData, error: stageError } = await supabase
      .from('followups')
      .select('id, leadid, followupstage, customerprofile, moveintime')
      .not('moveintime', 'is', null)
      .eq('followupstage', '已接收')
      .limit(5);
    
    if (stageError) {
      console.error('❌ 跟进阶段过滤失败:', stageError);
    } else {
      console.log('✅ 跟进阶段过滤成功，数据条数:', stageData?.length || 0);
    }
    
    // 测试3: 日期范围过滤
    console.log('🔍 测试3: 日期范围过滤');
    const startDate = '2025-01-01 00:00:00';
    const endDate = '2025-01-31 23:59:59';
    
    const { data: dateData, error: dateError } = await supabase
      .from('followups')
      .select('id, leadid, followupstage, customerprofile, moveintime')
      .not('moveintime', 'is', null)
      .gte('moveintime', startDate)
      .lte('moveintime', endDate)
      .limit(5);
    
    if (dateError) {
      console.error('❌ 日期范围过滤失败:', dateError);
    } else {
      console.log('✅ 日期范围过滤成功，数据条数:', dateData?.length || 0);
    }
    
    // 测试4: 组合过滤（跟进阶段 + 日期范围）
    console.log('🔍 测试4: 组合过滤（跟进阶段 + 日期范围）');
    const { data: combinedData, error: combinedError } = await supabase
      .from('followups')
      .select('id, leadid, followupstage, customerprofile, moveintime')
      .not('moveintime', 'is', null)
      .eq('followupstage', '已接收')
      .gte('moveintime', startDate)
      .lte('moveintime', endDate)
      .limit(5);
    
    if (combinedError) {
      console.error('❌ 组合过滤失败:', combinedError);
    } else {
      console.log('✅ 组合过滤成功，数据条数:', combinedData?.length || 0);
    }
    
    // 统计客户画像分布（仅用于验证数据）
    console.log('📊 客户画像分布统计（仅用于验证数据）:');
    const profileStats = {};
    basicData?.forEach(record => {
      const profile = record.customerprofile || '未知';
      profileStats[profile] = (profileStats[profile] || 0) + 1;
    });
    
    console.log('客户画像分布:', profileStats);
    
    // 统计跟进阶段分布
    console.log('📊 跟进阶段分布统计:');
    const stageStats = {};
    basicData?.forEach(record => {
      const stage = record.followupstage || '未知';
      stageStats[stage] = (stageStats[stage] || 0) + 1;
    });
    
    console.log('跟进阶段分布:', stageStats);
    
    console.log('🎉 移除客户画像筛选功能测试完成！');
    console.log('✅ 当前支持的过滤功能:');
    console.log('   - 日期范围过滤');
    console.log('   - 跟进阶段过滤');
    console.log('   - 组合过滤');
    console.log('❌ 已移除的过滤功能:');
    console.log('   - 客户画像过滤');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testNoProfileFilter(); 