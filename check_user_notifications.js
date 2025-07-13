import { createClient } from '@supabase/supabase-js';

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserNotifications() {
  console.log('🔍 检查用户周玲馨的通知...\n');
  
  const targetUserId = 1; // 周玲馨的用户ID
  
  try {
    // 1. 获取用户信息
    console.log('1. 获取用户信息...');
    const { data: user, error: userError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', targetUserId)
      .single();
    
    if (userError) {
      console.error('❌ 获取用户信息失败:', userError.message);
      return;
    }
    
    console.log(`✅ 用户: ${user.nickname} (ID: ${user.id})`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   状态: ${user.status}`);
    
    // 2. 获取用户的所有通知
    console.log('\n2. 获取用户通知...');
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    
    if (notificationsError) {
      console.error('❌ 获取通知失败:', notificationsError.message);
      return;
    }
    
    console.log(`✅ 找到 ${notifications.length} 条通知`);
    
    if (notifications.length === 0) {
      console.log('ℹ️ 用户暂无通知');
      return;
    }
    
    // 3. 显示通知详情
    console.log('\n3. 通知详情:');
    console.log('='.repeat(60));
    
    notifications.forEach((notification, index) => {
      console.log(`\n📋 通知 ${index + 1}:`);
      console.log(`   标题: ${notification.title}`);
      console.log(`   内容: ${notification.content}`);
      console.log(`   类型: ${notification.type}`);
      console.log(`   状态: ${notification.status}`);
      console.log(`   优先级: ${notification.priority}`);
      console.log(`   创建时间: ${new Date(notification.created_at).toLocaleString()}`);
      
      if (notification.read_at) {
        console.log(`   已读时间: ${new Date(notification.read_at).toLocaleString()}`);
      }
      
      if (notification.handled_at) {
        console.log(`   处理时间: ${new Date(notification.handled_at).toLocaleString()}`);
      }
      
      if (notification.metadata) {
        console.log(`   元数据: ${JSON.stringify(notification.metadata, null, 2)}`);
      }
    });
    
    // 4. 统计信息
    console.log('\n4. 通知统计:');
    console.log('='.repeat(40));
    
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => n.status === 'unread').length,
      read: notifications.filter(n => n.status === 'read').length,
      handled: notifications.filter(n => n.status === 'handled').length
    };
    
    console.log(`📊 总通知数: ${stats.total}`);
    console.log(`📖 未读: ${stats.unread}`);
    console.log(`👁️ 已读: ${stats.read}`);
    console.log(`✅ 已处理: ${stats.handled}`);
    
    // 按类型统计
    const typeStats = {};
    notifications.forEach(n => {
      typeStats[n.type] = (typeStats[n.type] || 0) + 1;
    });
    
    console.log('\n📋 按类型统计:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 条`);
    });
    
    // 按优先级统计
    const priorityStats = {};
    notifications.forEach(n => {
      priorityStats[n.priority] = (priorityStats[n.priority] || 0) + 1;
    });
    
    console.log('\n🎯 按优先级统计:');
    Object.entries(priorityStats).forEach(([priority, count]) => {
      console.log(`  优先级 ${priority}: ${count} 条`);
    });
    
    // 5. 最近通知
    console.log('\n5. 最近通知:');
    console.log('='.repeat(40));
    
    const recentNotifications = notifications.slice(0, 3);
    recentNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.title} (${notification.type})`);
    });
    
    // 6. 未读通知
    console.log('\n6. 未读通知:');
    console.log('='.repeat(40));
    
    const unreadNotifications = notifications.filter(n => n.status === 'unread');
    if (unreadNotifications.length === 0) {
      console.log('✅ 所有通知都已阅读');
    } else {
      unreadNotifications.forEach((notification, index) => {
        console.log(`${index + 1}. ${notification.title} (优先级: ${notification.priority})`);
      });
    }
    
    console.log('\n🎉 通知检查完成！');
    console.log(`💡 用户 ${user.nickname} 共有 ${notifications.length} 条通知`);
    
  } catch (error) {
    console.error('❌ 检查通知失败:', error.message);
  }
}

// 运行检查
checkUserNotifications(); 