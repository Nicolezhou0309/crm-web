import { createClient } from '@supabase/supabase-js';

// 测试头像框上传功能
async function testAvatarFrameUpload() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ 缺少 Supabase 环境变量');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    console.log('🔍 检查 Storage 桶配置...');
    
    // 检查 achievement-icons 桶是否存在
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ 获取 Storage 桶失败:', bucketsError);
      return;
    }

    console.log('📦 可用的 Storage 桶:', buckets.map(b => b.name));
    
    const achievementIconsBucket = buckets.find(b => b.name === 'achievement-icons');
    
    if (!achievementIconsBucket) {
      console.log('⚠️  achievement-icons 桶不存在，需要创建');
      console.log('💡 请在 Supabase Dashboard 中创建 achievement-icons 桶');
      return;
    }

    console.log('✅ achievement-icons 桶存在');

    // 检查头像框文件夹
    const { data: files, error: filesError } = await supabase.storage
      .from('achievement-icons')
      .list('avatar-frames');

    if (filesError) {
      console.log('⚠️  avatar-frames 文件夹不存在，将在上传时自动创建');
    } else {
      console.log('📁 avatar-frames 文件夹中的文件:', files);
    }

    // 检查数据库表结构
    console.log('🔍 检查 avatar_frames 表...');
    
    const { data: frames, error: framesError } = await supabase
      .from('avatar_frames')
      .select('*')
      .limit(5);

    if (framesError) {
      console.error('❌ 查询 avatar_frames 表失败:', framesError);
      return;
    }

    console.log('✅ avatar_frames 表存在，当前记录数:', frames.length);
    
    if (frames.length > 0) {
      console.log('📋 示例记录:', frames[0]);
    }

    console.log('🎉 头像框上传功能配置检查完成！');
    console.log('💡 现在可以在前端页面中测试头像框上传功能');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testAvatarFrameUpload(); 