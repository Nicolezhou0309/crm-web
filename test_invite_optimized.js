// 测试优化后的邀请用户功能
import { createClient } from '@supabase/supabase-js'

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5NzI5NywiZXhwIjoyMDUwMTczMjk3fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testInviteUser() {
  try {
    console.log('🧪 测试优化后的邀请用户功能...')
    
    // 测试参数
    const testData = {
      email: 'zhoulingxin0309@gmail.com', // 使用验证邮箱
      name: '测试用户',
      organizationId: 'test-org-id', // 需要替换为真实的组织ID
      redirectTo: 'https://crm-web-ncioles-projects.vercel.app/set-password'
    }
    
    console.log('📧 测试邀请邮件发送...')
    console.log('收件人:', testData.email)
    console.log('邀请人:', testData.name)
    console.log('组织ID:', testData.organizationId)
    
    // 调用invite-user Edge Function
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: testData
    })

    if (error) {
      console.error('❌ 邀请用户失败:', error)
      return
    }

    console.log('✅ 邀请用户成功！')
    console.log('响应数据:', data)
    
    if (data.success) {
      console.log('📧 邀请邮件已发送')
      console.log('邮件ID:', data.data?.email_id)
      console.log('组织名称:', data.data?.organization_name)
      console.log('重定向URL:', data.data?.redirect_url)
    }

  } catch (err) {
    console.error('❌ 测试过程中发生错误:', err)
  }
}

// 检查组织列表
async function checkOrganizations() {
  try {
    console.log('\n📋 检查可用组织...')
    
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name, admin')
      .limit(5)
    
    if (error) {
      console.error('❌ 获取组织列表失败:', error)
      return
    }
    
    console.log('✅ 可用组织列表:')
    organizations.forEach((org, index) => {
      console.log(`${index + 1}. ID: ${org.id}, 名称: ${org.name}, 管理员: ${org.admin}`)
    })
    
  } catch (err) {
    console.error('❌ 检查组织失败:', err)
  }
}

// 运行测试
async function runTests() {
  console.log('🚀 开始测试优化后的邀请用户功能...\n')
  
  await checkOrganizations()
  await testInviteUser()
  
  console.log('\n✅ 测试完成！')
}

runTests() 