// 简化测试invite-user函数
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTcyOTcsImV4cCI6MjA1MDE3MzI5N30.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInviteSimple() {
  try {
    console.log('🧪 简化测试invite-user函数...')
    
    // 1. 检查登录状态
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('❌ 用户未登录')
      return
    }
    
    console.log('✅ 用户已登录:', session.user.email)
    
    // 2. 获取用户组织
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
    
    // 3. 测试邀请
    const testData = {
      email: 'test-simple@example.com',
      name: '简化测试',
      organizationId: profile.organization_id
    }
    
    console.log('📧 发送邀请:', testData)
    
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: testData
    })
    
    if (error) {
      console.error('❌ 邀请失败:', error)
      console.log('状态码:', error.status)
      console.log('错误消息:', error.message)
      
      // 分析错误
      if (error.status === 500) {
        console.log('\n🔍 500错误可能原因:')
        console.log('   - Edge Function内部错误')
        console.log('   - 环境变量问题')
        console.log('   - 数据库连接问题')
        console.log('   - 权限检查失败')
      }
      
      return
    }
    
    console.log('✅ 邀请成功:', data)
    
  } catch (err) {
    console.error('❌ 测试出错:', err)
  }
}

testInviteSimple() 