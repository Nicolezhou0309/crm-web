import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInviteFunction() {
  try {
    console.log('=== 开始诊断邀请功能 ===');
    
    // 1. 检查用户登录状态
    console.log('\n1. 检查用户登录状态...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ 用户认证失败:', userError);
      return;
    }
    
    if (!user) {
      console.error('❌ 用户未登录');
      return;
    }
    
    console.log('✅ 用户已登录:', user.email);
    console.log('用户ID:', user.id);
    
    // 2. 检查组织数据
    console.log('\n2. 检查组织数据...');
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, admin, parent_id');
    
    if (orgError) {
      console.error('❌ 查询组织失败:', orgError);
      return;
    }
    
    console.log('✅ 组织数据:', organizations);
    
    // 3. 检查用户档案
    console.log('\n3. 检查用户档案...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ 查询用户档案失败:', profileError);
      return;
    }
    
    console.log('✅ 用户档案:', userProfile);
    
    // 4. 检查用户是否有管理权限
    console.log('\n4. 检查管理权限...');
    const userOrgs = organizations.filter(org => org.admin === user.id);
    console.log('用户管理的组织:', userOrgs);
    
    if (userOrgs.length === 0) {
      console.log('⚠️  用户没有直接管理的组织');
      
      // 检查是否有超级管理员权限
      const { data: { session } } = await supabase.auth.getSession();
      const isSuperAdmin = session?.access_token ? 
        JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64').toString()).role === 'service_role' : false;
      
      console.log('是否为超级管理员:', isSuperAdmin);
      
      if (!isSuperAdmin) {
        console.log('❌ 用户没有管理权限');
        return;
      }
    }
    
    // 5. 测试邀请功能
    console.log('\n5. 测试邀请功能...');
    const testOrg = userOrgs.length > 0 ? userOrgs[0] : organizations[0];
    console.log('使用组织进行测试:', testOrg);
    
    const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-user', {
      body: {
        email: 'test@example.com',
        name: 'Test User',
        organizationId: testOrg.id
      }
    });
    
    if (inviteError) {
      console.error('❌ 邀请失败:', inviteError);
    } else {
      console.log('✅ 邀请成功:', inviteResult);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 运行测试
testInviteFunction(); 