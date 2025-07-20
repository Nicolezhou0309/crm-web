// 诊断invite-user函数的500错误
import { createClient } from '@supabase/supabase-js'

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTcyOTcsImV4cCI6MjA1MDE3MzI5N30.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugInvite500Error() {
  try {
    console.log('🔍 开始诊断invite-user函数的500错误...')
    
    // 1. 检查用户登录状态
    console.log('\n1️⃣ 检查用户登录状态...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ 获取会话失败:', sessionError)
      return
    }
    
    if (!session) {
      console.log('❌ 用户未登录，需要先登录')
      return
    }
    
    console.log('✅ 用户已登录:', {
      userId: session.user.id,
      email: session.user.email
    })
    
    // 2. 获取用户档案
    console.log('\n2️⃣ 获取用户档案...')
    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    
    if (profileError) {
      console.error('❌ 获取用户档案失败:', profileError)
      return
    }
    
    console.log('✅ 用户档案:', {
      id: profile.id,
      organization_id: profile.organization_id,
      nickname: profile.nickname
    })
    
    // 3. 获取组织信息
    console.log('\n3️⃣ 获取组织信息...')
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single()
    
    if (orgError) {
      console.error('❌ 获取组织信息失败:', orgError)
      return
    }
    
    console.log('✅ 组织信息:', {
      id: organization.id,
      name: organization.name,
      admin: organization.admin
    })
    
    // 4. 检查权限
    console.log('\n4️⃣ 检查用户权限...')
    const isAdmin = organization.admin === session.user.id
    console.log('用户是否为管理员:', isAdmin)
    
    if (!isAdmin) {
      console.log('❌ 用户不是该组织的管理员，无法邀请用户')
      return
    }
    
    // 5. 测试邀请功能
    console.log('\n5️⃣ 测试邀请功能...')
    const testEmail = 'test-invite@example.com'
    const testName = '测试邀请用户'
    
    console.log('📧 邀请信息:', {
      email: testEmail,
      name: testName,
      organizationId: organization.id
    })
    
    // 调用invite-user函数
    const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-user', {
      body: {
        email: testEmail,
        name: testName,
        organizationId: organization.id,
        redirectTo: 'https://crm-web-ncioles-projects.vercel.app/set-password'
      }
    })
    
    if (inviteError) {
      console.error('❌ 邀请用户失败:', inviteError)
      console.log('错误详情:', {
        message: inviteError.message,
        status: inviteError.status,
        statusText: inviteError.statusText,
        name: inviteError.name
      })
      
      // 分析错误类型
      if (inviteError.status === 500) {
        console.log('\n🔍 500错误分析:')
        console.log('   - 可能是Edge Function内部错误')
        console.log('   - 可能是环境变量配置问题')
        console.log('   - 可能是数据库连接问题')
        console.log('   - 可能是权限检查失败')
      } else if (inviteError.status === 401) {
        console.log('\n🔍 401错误分析:')
        console.log('   - 用户未授权')
        console.log('   - JWT token无效或过期')
      } else if (inviteError.status === 403) {
        console.log('\n🔍 403错误分析:')
        console.log('   - 用户无权管理该组织')
        console.log('   - 组织权限配置问题')
      }
      
      return
    }
    
    console.log('✅ 邀请用户成功:', inviteResult)
    
    // 6. 分析结果
    console.log('\n6️⃣ 分析邀请结果...')
    if (inviteResult.method === 'supabase_invite') {
      console.log('✅ 使用了Supabase内置邀请功能')
      console.log('📧 邮件应该包含标准Supabase token')
    } else if (inviteResult.method === 'custom_invite') {
      console.log('✅ 使用了Resend自定义邀请功能')
      console.log('📧 邮件包含自定义token')
    }
    
    console.log('\n✅ 诊断完成！')
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error)
    console.log('错误堆栈:', error.stack)
  }
}

// 运行诊断
debugInvite500Error() 