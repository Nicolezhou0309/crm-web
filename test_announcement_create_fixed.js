// 测试修复后的公告创建功能
import { createClient } from '@supabase/supabase-js';

// 配置Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzI5NzAsImV4cCI6MjA1MDU0ODk3MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnnouncementCreateFixed() {
  console.log('🔍 测试修复后的公告创建功能...');
  
  try {
    // 1. 先登录获取用户token
    console.log('\n1. 登录获取用户token...');
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com', // 请替换为实际的测试用户邮箱
      password: 'testpassword'    // 请替换为实际的测试用户密码
    });
    
    if (authError) {
      console.error('❌ 登录失败:', authError.message);
      console.log('💡 请确保测试用户存在且有正确的邮箱和密码');
      return;
    }
    
    console.log('✅ 登录成功，用户:', user.email);
    
    // 2. 获取用户token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ 无法获取用户会话');
      return;
    }
    
    console.log('✅ 获取到用户token');
    
    // 3. 测试公告创建API
    console.log('\n2. 测试公告创建API...');
    const response = await fetch(`${supabaseUrl}/functions/v1/notification-system?action=create_announcement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        title: '测试公告 - 修复后',
        content: '这是一个测试公告，用于验证修复后的功能是否正常工作。',
        type: 'info',
        priority: 0,
        start_time: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    console.log('📝 API响应状态:', response.status);
    console.log('📝 API响应内容:', result);
    
    if (response.ok) {
      console.log('✅ 公告创建成功！');
      console.log('📋 公告ID:', result.data?.announcement_id);
    } else {
      console.error('❌ 公告创建失败');
      console.error('❌ 错误详情:', result);
    }
    
    // 4. 验证公告是否真的创建成功
    if (response.ok && result.data?.announcement_id) {
      console.log('\n3. 验证公告是否创建成功...');
      const { data: announcements, error: fetchError } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', result.data.announcement_id)
        .single();
      
      if (fetchError) {
        console.error('❌ 验证失败:', fetchError.message);
      } else {
        console.log('✅ 验证成功，公告已创建:');
        console.log('   - ID:', announcements.id);
        console.log('   - 标题:', announcements.title);
        console.log('   - 内容:', announcements.content);
        console.log('   - 创建者:', announcements.created_by);
        console.log('   - 创建时间:', announcements.created_at);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 5. 清理：退出登录
    await supabase.auth.signOut();
    console.log('\n🧹 已退出登录');
  }
}

// 运行测试
testAnnouncementCreateFixed().then(() => {
  console.log('\n🏁 测试完成');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}); 