import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFrequencyControl() {
  console.log('=== 频率控制系统测试 ===');
  
  try {
    // 使用一个已知的用户ID进行测试（假设用户ID=1存在）
    const testUserId = 1;
    
    console.log('\n1. 测试频率检查函数...');
    
    // 第一次检查 - 应该允许
    const { data: result1, error: error1 } = await supabase
      .rpc('check_operation_frequency', { 
        p_user_id: testUserId, 
        p_operation_type: 'followup' 
      });
    
    console.log('第一次频率检查结果:', result1);
    console.log('第一次频率检查错误:', error1);
    
    console.log('\n2. 记录第一次操作...');
    
    // 记录第一次操作
    const { data: record1, error: recordError1 } = await supabase
      .rpc('record_operation', { 
        p_user_id: testUserId, 
        p_operation_type: 'followup',
        p_record_id: 'test-1'
      });
    
    console.log('第一次操作记录结果:', record1);
    console.log('第一次操作记录错误:', recordError1);
    
    console.log('\n3. 再次检查频率...');
    
    // 第二次检查 - 应该仍然允许
    const { data: result2, error: error2 } = await supabase
      .rpc('check_operation_frequency', { 
        p_user_id: testUserId, 
        p_operation_type: 'followup' 
      });
    
    console.log('第二次频率检查结果:', result2);
    console.log('第二次频率检查错误:', error2);
    
    console.log('\n4. 快速连续记录多次操作...');
    
    // 快速记录多次操作来测试限制
    for (let i = 2; i <= 6; i++) {
      const { data: record, error: recordError } = await supabase
        .rpc('record_operation', { 
          p_user_id: testUserId, 
          p_operation_type: 'followup',
          p_record_id: `test-${i}`
        });
      
      console.log(`第${i}次操作记录结果:`, record);
      console.log(`第${i}次操作记录错误:`, recordError);
    }
    
    console.log('\n5. 检查是否达到限制...');
    
    // 检查是否达到限制
    const { data: result3, error: error3 } = await supabase
      .rpc('check_operation_frequency', { 
        p_user_id: testUserId, 
        p_operation_type: 'followup' 
      });
    
    console.log('限制检查结果:', result3);
    console.log('限制检查错误:', error3);
    
    console.log('\n6. 查看最近的频率控制记录...');
    
    // 查看记录
    const { data: records, error: recordsError } = await supabase
      .from('operation_frequency_control')
      .select('*')
      .eq('user_id', testUserId)
      .eq('operation_type', 'followup')
      .order('created_at', { ascending: false });
    
    console.log('频率控制记录:', records);
    console.log('记录查询错误:', recordsError);
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testFrequencyControl().then(() => {
  console.log('\n=== 测试完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
}); 