import { supabase } from './src/supaClient.js';

async function testShowingsData() {
  try {
    console.log('测试获取带看记录数据...');
    
    const { data, error } = await supabase.rpc('filter_showings', {
      p_limit: 5,
      p_offset: 0
    });
    
    if (error) {
      console.error('获取数据失败:', error);
      return;
    }
    
    console.log('获取到的数据:', JSON.stringify(data, null, 2));
    
    if (data && data.length > 0) {
      const firstRecord = data[0];
      console.log('第一条记录的字段:', Object.keys(firstRecord));
      console.log('约访销售ID:', firstRecord.interviewsales_user_id);
      console.log('约访销售昵称:', firstRecord.interviewsales_nickname);
      console.log('带看销售ID:', firstRecord.showingsales);
      console.log('带看销售昵称:', firstRecord.showingsales_nickname);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testShowingsData(); 