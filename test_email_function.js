import { createClient } from '@supabase/supabase-js'

// 配置Supabase客户端
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5NzI5NywiZXhwIjoyMDUwMTczMjk3fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEmailFunction() {
  try {
    console.log('🚀 开始测试邮件发送功能...')
    
    // 调用test-email Edge Function
    const { data, error } = await supabase.functions.invoke('test-email', {
      body: {
        to: 'test@example.com' // 请替换为您的测试邮箱
      }
    })

    if (error) {
      console.error('❌ Edge Function调用失败:', error)
      return
    }

    console.log('✅ 邮件发送结果:', data)
    
    if (data.success) {
      console.log('🎉 测试邮件发送成功！')
      console.log('邮件ID:', data.data?.id)
    } else {
      console.log('❌ 邮件发送失败:', data.error)
    }

  } catch (err) {
    console.error('❌ 测试过程中发生错误:', err)
  }
}

// 运行测试
testEmailFunction() 