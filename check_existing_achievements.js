import { createClient } from '@supabase/supabase-js';

// 从环境变量获取Supabase配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('错误: 请设置环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingData() {
  try {
    console.log('🔍 检查现有成就数据...\n');

    // 检查成就表
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .order('id');

    if (achievementsError) {
      console.error('❌ 查询成就表失败:', achievementsError);
    } else {
      console.log('📊 成就表数据:');
      console.log(`   总数: ${achievements.length}`);
      if (achievements.length > 0) {
        achievements.forEach(achievement => {
          console.log(`   - ${achievement.code}: ${achievement.name} (${achievement.description})`);
        });
      }
      console.log('');
    }

    // 检查用户成就进度
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from('user_achievements')
      .select('*')
      .order('user_id');

    if (userAchievementsError) {
      console.error('❌ 查询用户成就进度失败:', userAchievementsError);
    } else {
      console.log('📊 用户成就进度数据:');
      console.log(`   总数: ${userAchievements.length}`);
      console.log('');
    }

    // 检查头像框
    const { data: avatarFrames, error: avatarFramesError } = await supabase
      .from('avatar_frames')
      .select('*')
      .order('id');

    if (avatarFramesError) {
      console.error('❌ 查询头像框失败:', avatarFramesError);
    } else {
      console.log('📊 头像框数据:');
      console.log(`   总数: ${avatarFrames.length}`);
      if (avatarFrames.length > 0) {
        avatarFrames.forEach(frame => {
          console.log(`   - ${frame.code}: ${frame.name} (${frame.description})`);
        });
      }
      console.log('');
    }

    // 检查勋章
    const { data: medals, error: medalsError } = await supabase
      .from('medals')
      .select('*')
      .order('id');

    if (medalsError) {
      console.error('❌ 查询勋章失败:', medalsError);
    } else {
      console.log('📊 勋章数据:');
      console.log(`   总数: ${medals.length}`);
      if (medals.length > 0) {
        medals.forEach(medal => {
          console.log(`   - ${medal.code}: ${medal.name} (${medal.description})`);
        });
      }
      console.log('');
    }

    // 检查用户头像框关联
    const { data: userAvatarFrames, error: userAvatarFramesError } = await supabase
      .from('user_avatar_frames')
      .select('*')
      .order('user_id');

    if (userAvatarFramesError) {
      console.error('❌ 查询用户头像框关联失败:', userAvatarFramesError);
    } else {
      console.log('📊 用户头像框关联数据:');
      console.log(`   总数: ${userAvatarFrames.length}`);
      console.log('');
    }

    // 检查用户勋章关联
    const { data: userMedals, error: userMedalsError } = await supabase
      .from('user_medals')
      .select('*')
      .order('user_id');

    if (userMedalsError) {
      console.error('❌ 查询用户勋章关联失败:', userMedalsError);
    } else {
      console.log('📊 用户勋章关联数据:');
      console.log(`   总数: ${userMedals.length}`);
      console.log('');
    }

    console.log('✅ 数据检查完成');

  } catch (error) {
    console.error('❌ 检查数据时发生错误:', error);
  }
}

checkExistingData(); 