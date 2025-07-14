import { createClient } from '@supabase/supabase-js';

// 配置Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请设置环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  console.log('💡 请检查您的 .env 文件或环境变量设置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAchievementSystem() {
  console.log('🔍 验证成就系统部署状态...\n');
  
  try {
    // 1. 检查表是否存在
    console.log('📋 检查数据库表...');
    
    const tables = [
      'achievements',
      'badges', 
      'avatar_frames',
      'user_achievements',
      'user_badges',
      'user_avatar_frames',
      'achievement_progress_logs'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}: 表不存在或无法访问`);
        } else {
          console.log(`✅ ${table}: 表存在`);
        }
      } catch (err) {
        console.log(`❌ ${table}: 表不存在`);
      }
    }
    
    console.log('\n📊 检查初始数据...');
    
    // 2. 检查初始数据
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*');
    
    if (achievementsError) {
      console.log('❌ 无法访问成就表');
    } else {
      console.log(`✅ 成就数量: ${achievements.length}`);
    }
    
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('*');
    
    if (badgesError) {
      console.log('❌ 无法访问勋章表');
    } else {
      console.log(`✅ 勋章数量: ${badges.length}`);
    }
    
    const { data: frames, error: framesError } = await supabase
      .from('avatar_frames')
      .select('*');
    
    if (framesError) {
      console.log('❌ 无法访问头像框表');
    } else {
      console.log(`✅ 头像框数量: ${frames.length}`);
    }
    
    // 3. 检查函数是否存在
    console.log('\n🔧 检查数据库函数...');
    
    // 注意：这里只是示例，实际检查函数需要管理员权限
    console.log('ℹ️  函数检查需要管理员权限，请在Supabase Dashboard中验证');
    
    console.log('\n🎯 验证完成!');
    console.log('\n📝 下一步:');
    console.log('1. 在Supabase Dashboard中检查SQL是否执行成功');
    console.log('2. 验证所有表和数据是否正确创建');
    console.log('3. 测试前端组件是否正常工作');
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
  }
}

// 运行验证
verifyAchievementSystem(); 