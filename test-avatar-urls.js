/**
 * 测试头像URL格式和显示问题
 */

import { createClient } from '@supabase/supabase-js';

// 从环境变量获取配置
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

console.log('🔍 检查头像URL格式...\n');

async function testAvatarUrls() {
  try {
    // 创建Supabase客户端
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 查询用户头像URL
    console.log('1️⃣ 查询数据库中的头像URL...');
    const { data: profiles, error } = await supabase
      .from('users_profile')
      .select('id, user_id, nickname, avatar_url')
      .not('avatar_url', 'is', null)
      .limit(5);
    
    if (error) {
      console.error('❌ 查询失败:', error.message);
      return;
    }
    
    if (!profiles || profiles.length === 0) {
      console.log('⚠️ 未找到有头像的用户');
      return;
    }
    
    console.log(`✅ 找到 ${profiles.length} 个有头像的用户:`);
    
    for (const profile of profiles) {
      console.log(`\n用户: ${profile.nickname || profile.user_id}`);
      console.log(`头像URL: ${profile.avatar_url}`);
      
      // 分析URL类型
      if (profile.avatar_url.includes('vlinker-crm.oss-cn-shanghai.aliyuncs.com')) {
        console.log('✅ OSS URL格式');
        
        // 测试URL访问
        try {
          const response = await fetch(profile.avatar_url, { method: 'HEAD' });
          if (response.ok) {
            console.log('✅ OSS图片可访问');
          } else {
            console.log(`❌ OSS图片访问失败: ${response.status}`);
          }
        } catch (fetchError) {
          console.log(`❌ OSS图片访问异常: ${fetchError.message}`);
        }
      } else if (profile.avatar_url.includes('supabase')) {
        console.log('✅ Supabase Storage URL格式');
      } else {
        console.log('⚠️ 未知URL格式');
      }
    }
    
    // 检查OSS配置
    console.log('\n2️⃣ 检查OSS配置...');
    const { getImagePublicUrlDirect } = await import('./src/utils/ossUploadUtils.ts');
    
    // 测试OSS URL生成
    const testPath = 'avatars/test.jpg';
    const ossUrl = getImagePublicUrlDirect(testPath);
    console.log(`OSS公共URL: ${ossUrl}`);
    
    // 测试OSS URL访问
    try {
      const response = await fetch(ossUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ OSS公共URL可访问');
      } else {
        console.log(`❌ OSS公共URL访问失败: ${response.status}`);
      }
    } catch (fetchError) {
      console.log(`❌ OSS公共URL访问异常: ${fetchError.message}`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testAvatarUrls().catch(console.error);
