// 调试脚本：检查followups表中的moveintime数据
import { createClient } from '@supabase/supabase-js';

// 请替换为您的实际Supabase配置
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFollowupsData() {
  console.log('🔍 检查followups表中的moveintime数据...');
  
  try {
    // 检查所有followups记录
    const { data: allFollowups, error: allError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .limit(10);
    
    if (allError) {
      console.error('❌ 查询所有记录失败:', allError);
      return;
    }
    
    console.log('📊 所有followups记录 (前10条):');
    console.table(allFollowups);
    
    // 检查有moveintime的记录
    const { data: withMoveintime, error: moveintimeError } = await supabase
      .from('followups')
      .select('id, leadid, moveintime, followupstage')
      .not('moveintime', 'is', null)
      .limit(10);
    
    if (moveintimeError) {
      console.error('❌ 查询moveintime记录失败:', moveintimeError);
      return;
    }
    
    console.log('\n📅 有moveintime的记录 (前10条):');
    console.table(withMoveintime);
    
    // 检查moveintime的数据类型
    if (withMoveintime && withMoveintime.length > 0) {
      console.log('\n🔍 moveintime数据类型分析:');
      withMoveintime.forEach((record, index) => {
        console.log(`记录 ${index + 1}:`);
        console.log(`  - ID: ${record.id}`);
        console.log(`  - LeadID: ${record.leadid}`);
        console.log(`  - Moveintime: ${record.moveintime} (类型: ${typeof record.moveintime})`);
        console.log(`  - 跟进阶段: ${record.followupstage}`);
        console.log('');
      });
    }
    
    // 检查日期范围查询
    const startDate = '2025-01-01 00:00:00';
    const endDate = '2025-01-31 23:59:59';
    
    console.log(`\n🔍 测试日期范围查询 (${startDate} 到 ${endDate}):`);
    
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
    
    console.log(`✅ 日期范围查询成功，找到 ${rangeData?.length || 0} 条记录`);
    if (rangeData && rangeData.length > 0) {
      console.table(rangeData);
    }
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
  }
}

// 运行检查
checkFollowupsData(); 