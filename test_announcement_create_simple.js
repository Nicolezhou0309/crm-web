// 简化测试：直接测试数据库函数
import { createClient } from '@supabase/supabase-js';

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnnouncementCreateSimple() {
  console.log('🔍 简化测试：直接测试数据库函数...');
  
  try {
    // 1. 检查用户是否存在
    console.log('\n1. 检查测试用户...');
    const { data: users, error: usersError } = await supabase
      .from('users_profile')
      .select('id, nickname, email')
      .limit(5);
    
    if (usersError) {
      console.error('❌ 获取用户列表失败:', usersError.message);
      return;
    }
    
    console.log('✅ 找到用户:');
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, 昵称: ${user.nickname}, 邮箱: ${user.email}`);
    });
    
    if (users.length === 0) {
      console.error('❌ 没有找到任何用户');
      return;
    }
    
    // 使用第一个用户作为测试
    const testUserId = users[0].id;
    console.log(`\n🎯 使用用户ID ${testUserId} 进行测试`);
    
    // 2. 测试create_announcement函数
    console.log('\n2. 测试create_announcement函数...');
    const { data: announcementId, error: createError } = await supabase
      .rpc('create_announcement', {
        p_title: '测试公告 - 简化测试',
        p_content: '这是一个简化测试，直接调用数据库函数。',
        p_type: 'info',
        p_priority: 0,
        p_target_roles: null,
        p_target_organizations: null,
        p_start_time: new Date().toISOString(),
        p_end_time: null,
        p_created_by: testUserId
      });
    
    if (createError) {
      console.error('❌ create_announcement函数调用失败:', createError);
      console.error('❌ 错误详情:', createError.message);
      return;
    }
    
    console.log('✅ create_announcement函数调用成功！');
    console.log('📋 返回的公告ID:', announcementId);
    
    // 3. 验证公告是否创建成功
    console.log('\n3. 验证公告是否创建成功...');
    const { data: announcement, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', announcementId)
      .single();
    
    if (fetchError) {
      console.error('❌ 验证失败:', fetchError.message);
    } else {
      console.log('✅ 验证成功，公告已创建:');
      console.log('   - ID:', announcement.id);
      console.log('   - 标题:', announcement.title);
      console.log('   - 内容:', announcement.content);
      console.log('   - 类型:', announcement.type);
      console.log('   - 优先级:', announcement.priority);
      console.log('   - 创建者:', announcement.created_by);
      console.log('   - 创建时间:', announcement.created_at);
      console.log('   - 是否激活:', announcement.is_active);
    }
    
    // 4. 测试get_user_announcements函数
    console.log('\n4. 测试get_user_announcements函数...');
    const { data: userAnnouncements, error: getError } = await supabase
      .rpc('get_user_announcements', { p_user_id: testUserId });
    
    if (getError) {
      console.error('❌ get_user_announcements函数调用失败:', getError.message);
    } else {
      console.log('✅ get_user_announcements函数调用成功！');
      console.log(`📋 找到 ${userAnnouncements.length} 条公告`);
      userAnnouncements.forEach((announcement, index) => {
        console.log(`   ${index + 1}. ${announcement.title} (${announcement.type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testAnnouncementCreateSimple().then(() => {
  console.log('\n🏁 测试完成');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}); 