// 测试域名配置
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTcyOTcsImV4cCI6MjA1MDE3MzI5N30.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDomainConfig() {
  try {
    console.log('🔍 测试域名配置...')
    
    // 1. 检查用户登录状态
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('❌ 用户未登录，请先登录')
      return
    }
    
    console.log('✅ 用户已登录:', session.user.email)
    
    // 2. 获取用户组织信息
    const { data: profile } = await supabase
      .from('users_profile')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()
    
    if (!profile?.organization_id) {
      console.log('❌ 用户没有组织')
      return
    }
    
    console.log('✅ 组织ID:', profile.organization_id)
    
    // 3. 测试邀请功能
    const testData = {
      email: 'zhoulingxin0309@gmail.com', // 使用已验证的邮箱
      name: '域名配置测试',
      organizationId: profile.organization_id
    }
    
    console.log('📧 发送邀请:', testData)
    
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: testData
    })
    
    if (error) {
      console.error('❌ 邀请失败:', error)
      console.log('错误状态:', error.status)
      console.log('错误消息:', error.message)
      
      // 分析错误
      if (error.status === 500) {
        console.log('\n🔍 500错误分析:')
        console.log('   - 可能是域名配置问题')
        console.log('   - 可能是环境变量问题')
        console.log('   - 可能是权限问题')
      }
      
      return
    }
    
    console.log('✅ 邀请成功:', data)
    
    // 4. 检查重定向URL
    if (data.data?.redirect_url) {
      console.log('\n🔗 重定向URL:', data.data.redirect_url)
      
      // 验证URL格式
      const url = new URL(data.data.redirect_url)
      console.log('✅ 域名:', url.hostname)
      console.log('✅ 路径:', url.pathname)
      console.log('✅ 协议:', url.protocol)
      
      // 检查是否是预期的域名
      if (url.hostname === 'crm-web-ncioles-projects.vercel.app') {
        console.log('✅ 域名配置正确！')
      } else {
        console.log('⚠️ 域名配置可能有问题')
        console.log('   预期: crm-web-ncioles-projects.vercel.app')
        console.log('   实际:', url.hostname)
      }
    }
    
    // 5. 检查邀请方法
    if (data.method === 'supabase_invite') {
      console.log('\n📧 使用了Supabase内置邀请功能')
      console.log('✅ 邮件包含标准Supabase token')
    } else if (data.method === 'custom_invite') {
      console.log('\n📧 使用了Resend自定义邀请功能')
      console.log('✅ 邮件包含自定义token')
    }
    
    console.log('\n✅ 域名配置测试完成！')
    
  } catch (err) {
    console.error('❌ 测试过程中出错:', err)
  }
}

testDomainConfig() 