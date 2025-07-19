import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAuth() {
  console.log('=== 用户认证调试 ===');
  
  try {
    // 1. 检查当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('当前认证用户:', user);
    console.log('用户认证错误:', userError);
    
    if (user && user.id) {
      console.log('用户ID (UUID):', user.id);
      
      // 2. 查询用户profile
      const { data: profileData, error: profileError } = await supabase
        .from('users_profile')
        .select('id, user_id, auth_id, nickname')
        .eq('auth_id', user.id)
        .single();
      
      console.log('用户Profile查询结果:', { profileData, profileError });
      
      if (profileData) {
        console.log('用户数字ID:', profileData.id);
        console.log('用户昵称:', profileData.nickname);
        
        // 3. 测试频率控制
        const { data: freqTest, error: freqError } = await supabase
          .rpc('check_operation_frequency', { 
            p_user_id: profileData.id, 
            p_operation_type: 'followup' 
          });
        
        console.log('频率控制测试结果:', freqTest);
        console.log('频率控制测试错误:', freqError);
        
        // 4. 测试记录操作
        const { data: recordTest, error: recordError } = await supabase
          .rpc('record_operation', { 
            p_user_id: profileData.id, 
            p_operation_type: 'followup',
            p_record_id: 'debug-test-123'
          });
        
        console.log('记录操作测试结果:', recordTest);
        console.log('记录操作测试错误:', recordError);
      }
    } else {
      console.log('没有认证用户，需要先登录');
    }
    
  } catch (error) {
    console.error('调试过程中发生错误:', error);
  }
}

debugAuth().then(() => {
  console.log('\n=== 调试完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
}); 