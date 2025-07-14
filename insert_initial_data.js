import { createClient } from '@supabase/supabase-js';

// 配置Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请设置环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertInitialData() {
  console.log('🚀 开始插入初始数据...\n');
  
  try {
    // 1. 插入头像框
    console.log('🖼️ 插入头像框数据...');
    const avatarFrames = [
      {
        name: '默认头像框',
        description: '系统默认头像框',
        frame_type: 'border',
        frame_data: { border: '2px solid #e0e0e0', borderRadius: '50%' },
        rarity: 'common',
        sort_order: 0
      },
      {
        name: '青铜头像框',
        description: '青铜成就头像框',
        frame_type: 'border',
        frame_data: { border: '3px solid #cd7f32', borderRadius: '50%', boxShadow: '0 0 10px #cd7f32' },
        rarity: 'common',
        sort_order: 1
      },
      {
        name: '白银头像框',
        description: '白银成就头像框',
        frame_type: 'border',
        frame_data: { border: '3px solid #c0c0c0', borderRadius: '50%', boxShadow: '0 0 15px #c0c0c0' },
        rarity: 'rare',
        sort_order: 2
      },
      {
        name: '黄金头像框',
        description: '黄金成就头像框',
        frame_type: 'border',
        frame_data: { border: '3px solid #ffd700', borderRadius: '50%', boxShadow: '0 0 20px #ffd700' },
        rarity: 'epic',
        sort_order: 3
      },
      {
        name: '钻石头像框',
        description: '钻石成就头像框',
        frame_type: 'border',
        frame_data: { border: '3px solid #b9f2ff', borderRadius: '50%', boxShadow: '0 0 25px #b9f2ff' },
        rarity: 'legendary',
        sort_order: 4
      }
    ];

    const { data: framesData, error: framesError } = await supabase
      .from('avatar_frames')
      .insert(avatarFrames)
      .select();

    if (framesError) {
      console.log('❌ 插入头像框失败:', framesError.message);
    } else {
      console.log(`✅ 成功插入 ${framesData.length} 个头像框`);
    }

    // 2. 插入勋章
    console.log('\n🏅 插入勋章数据...');
    const badges = [
      { name: '新手销售', description: '完成第一个跟进', icon: '🎯', icon_type: 'emoji', color: '#52c41a', rarity: 'common', sort_order: 1 },
      { name: '成交达人', description: '完成第一笔成交', icon: '💎', icon_type: 'emoji', color: '#1890ff', rarity: 'rare', sort_order: 2 },
      { name: '转化大师', description: '转化率达到20%', icon: '🏆', icon_type: 'emoji', color: '#fa8c16', rarity: 'epic', sort_order: 3 },
      { name: '团队领袖', description: '帮助同事10次', icon: '👑', icon_type: 'emoji', color: '#722ed1', rarity: 'legendary', sort_order: 4 },
      { name: '连续签到', description: '连续签到30天', icon: '📅', icon_type: 'emoji', color: '#eb2f96', rarity: 'rare', sort_order: 5 }
    ];

    const { data: badgesData, error: badgesError } = await supabase
      .from('badges')
      .insert(badges)
      .select();

    if (badgesError) {
      console.log('❌ 插入勋章失败:', badgesError.message);
    } else {
      console.log(`✅ 成功插入 ${badgesData.length} 个勋章`);
    }

    // 3. 插入成就
    console.log('\n🎯 插入成就数据...');
    const achievements = [
      { code: 'first_followup', name: '首次跟进', description: '完成第一个线索跟进', category: 'milestone', icon: '📝', icon_type: 'emoji', color: '#52c41a', points_reward: 50, requirements: { followup_count: 1 }, sort_order: 1 },
      { code: 'followup_master', name: '跟进达人', description: '完成100个线索跟进', category: 'milestone', icon: '📊', icon_type: 'emoji', color: '#1890ff', points_reward: 200, requirements: { followup_count: 100 }, sort_order: 2 },
      { code: 'first_deal', name: '首次成交', description: '完成第一笔成交', category: 'milestone', icon: '💎', icon_type: 'emoji', color: '#fa8c16', points_reward: 500, requirements: { deal_count: 1 }, sort_order: 3 },
      { code: 'deal_master', name: '成交大师', description: '完成50笔成交', category: 'milestone', icon: '🏆', icon_type: 'emoji', color: '#722ed1', points_reward: 1000, requirements: { deal_count: 50 }, sort_order: 4 },
      { code: 'conversion_master', name: '转化大师', description: '转化率达到20%', category: 'skill', icon: '📈', icon_type: 'emoji', color: '#eb2f96', points_reward: 300, requirements: { conversion_rate: 20 }, sort_order: 5 },
      { code: 'points_collector', name: '积分收集者', description: '累计获得1000积分', category: 'milestone', icon: '💰', icon_type: 'emoji', color: '#52c41a', points_reward: 100, requirements: { total_points_earned: 1000 }, sort_order: 6 },
      { code: 'team_helper', name: '团队助手', description: '帮助同事10次', category: 'social', icon: '🤝', icon_type: 'emoji', color: '#1890ff', points_reward: 150, requirements: { help_count: 10 }, sort_order: 7 },
      { code: 'daily_checkin', name: '连续签到', description: '连续签到30天', category: 'special', icon: '📅', icon_type: 'emoji', color: '#fa8c16', points_reward: 200, requirements: { consecutive_checkins: 30 }, sort_order: 8 }
    ];

    const { data: achievementsData, error: achievementsError } = await supabase
      .from('achievements')
      .insert(achievements)
      .select();

    if (achievementsError) {
      console.log('❌ 插入成就失败:', achievementsError.message);
    } else {
      console.log(`✅ 成功插入 ${achievementsData.length} 个成就`);
    }

    // 4. 验证结果
    console.log('\n🔍 验证插入结果...');
    
    const { data: finalAchievements } = await supabase.from('achievements').select('*');
    const { data: finalBadges } = await supabase.from('badges').select('*');
    const { data: finalFrames } = await supabase.from('avatar_frames').select('*');

    console.log(`📊 最终数据统计:`);
    console.log(`   - 成就: ${finalAchievements?.length || 0} 个`);
    console.log(`   - 勋章: ${finalBadges?.length || 0} 个`);
    console.log(`   - 头像框: ${finalFrames?.length || 0} 个`);

    console.log('\n🎉 初始数据插入完成!');

  } catch (error) {
    console.error('❌ 插入数据时发生错误:', error);
  }
}

// 运行插入
insertInitialData(); 