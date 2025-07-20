// 直接测试invite-user函数
import { createClient } from '@supabase/supabase-js'

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTcyOTcsImV4cCI6MjA1MDE3MzI5N30.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInviteDirect() {
  try {
    console.log('🧪 直接测试invite-user函数...')
    
    // 首先登录用户（如果需要）
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('❌ 用户未登录，请先登录')
      return
    }
    
    console.log('✅ 用户已登录:', session.user.email)
    
    // 获取用户组织信息
    const { data: profile } = await supabase
      .from('users_profile')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()
    
    if (!profile?.organization_id) {
      console.log('❌ 用户没有关联的组织')
      return
    }
    
    console.log('✅ 用户组织ID:', profile.organization_id)
    
    // 测试邀请
    const testData = {
      email: 'test-direct@example.com',
      name: '直接测试用户',
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
      
      // 尝试获取更多错误信息
      if (error.context) {
        console.log('错误上下文:', error.context)
      }
      
      return
    }
    
    console.log('✅ 邀请成功:', data)
    
  } catch (err) {
    console.error('❌ 测试过程中出错:', err)
  }
}

testInviteDirect() 