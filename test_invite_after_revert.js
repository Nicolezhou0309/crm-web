// 测试回退版本后的邀请功能
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTcyOTcsImV4cCI6MjA1MDE3MzI5N30.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInviteAfterRevert() {
  try {
    console.log('🧪 测试回退版本后的邀请功能...')
    console.log('📅 测试时间:', new Date().toISOString())
    console.log('🔄 当前版本: c83f919 (回退版本)')
    
    // 1. 检查用户登录状态
    console.log('\n1️⃣ 检查用户登录状态...')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('❌ 用户未登录，请先登录')
      console.log('💡 请访问应用并登录后再运行此测试')
      return
    }
    
    console.log('✅ 用户已登录:', {
      userId: session.user.id,
      email: session.user.email
    })
    
    // 2. 获取用户组织信息
    console.log('\n2️⃣ 获取用户组织信息...')
    const { data: profile } = await supabase
      .from('users_profile')
      .select('organization_id, nickname')
      .eq('user_id', session.user.id)
      .single()
    
    if (!profile?.organization_id) {
      console.log('❌ 用户没有关联的组织')
      return
    }
    
    console.log('✅ 用户组织信息:', {
      organizationId: profile.organization_id,
      nickname: profile.nickname
    })
    
    // 3. 测试邀请功能
    console.log('\n3️⃣ 测试邀请功能...')
    const testData = {
      email: 'zhoulingxin0309@gmail.com', // 使用已验证的邮箱
      name: '回退版本测试用户',
      organizationId: profile.organization_id
    }
    
    console.log('📧 邀请数据:', testData)
    console.log('🔄 开始调用invite-user函数...')
    
    const startTime = Date.now()
    
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: testData
    })
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`⏱️ 函数执行时间: ${duration}ms`)
    
    if (error) {
      console.error('❌ 邀请失败:', error)
      console.log('错误详情:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        name: error.name
      })
      
      // 分析错误类型
      if (error.status === 500) {
        console.log('\n🔍 500错误分析:')
        console.log('   - 检查Supabase控制台的函数日志')
        console.log('   - 可能是环境变量配置问题')
        console.log('   - 可能是数据库连接问题')
        console.log('   - 可能是权限检查失败')
      } else if (error.status === 401) {
        console.log('\n🔍 401错误分析:')
        console.log('   - 用户未授权')
        console.log('   - JWT token无效或过期')
      } else if (error.status === 403) {
        console.log('\n🔍 403错误分析:')
        console.log('   - 用户无权管理该组织')
        console.log('   - 组织权限配置问题')
      }
      
      return
    }
    
    console.log('✅ 邀请成功:', data)
    
    // 4. 分析结果
    console.log('\n4️⃣ 分析邀请结果...')
    if (data.method === 'supabase_invite') {
      console.log('✅ 使用了Supabase内置邀请功能')
      console.log('📧 邮件应该包含标准Supabase token')
      console.log('🔗 重定向URL:', data.data?.redirect_url)
    } else if (data.method === 'custom_invite') {
      console.log('✅ 使用了Resend自定义邀请功能')
      console.log('📧 邮件包含自定义token')
      console.log('🔗 重定向URL:', data.data?.redirect_url)
    }
    
    // 5. 检查重定向URL
    if (data.data?.redirect_url) {
      console.log('\n5️⃣ 检查重定向URL...')
      const url = new URL(data.data.redirect_url)
      console.log('✅ URL解析成功:', {
        protocol: url.protocol,
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search
      })
      
      // 验证域名
      if (url.hostname === 'crm-web-ncioles-projects.vercel.app') {
        console.log('✅ 域名配置正确')
      } else {
        console.log('⚠️ 域名配置可能有问题')
        console.log('   预期: crm-web-ncioles-projects.vercel.app')
        console.log('   实际:', url.hostname)
      }
    }
    
    console.log('\n✅ 测试完成！')
    console.log('📋 下一步:')
    console.log('   1. 检查邮箱是否收到邀请邮件')
    console.log('   2. 点击邮件中的链接测试重定向')
    console.log('   3. 测试新的SetPassword页面流程')
    console.log('   4. 验证前端拦截和密码设置功能')
    
  } catch (err) {
    console.error('❌ 测试过程中出错:', err)
    console.log('错误堆栈:', err.stack)
  }
}

testInviteAfterRevert() 