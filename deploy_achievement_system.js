const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 配置Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployAchievementSystem() {
  try {
    console.log('🚀 开始部署成就系统...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'sql-scripts/achievement-system/create_achievement_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📖 读取SQL文件成功');
    
    // 执行SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ SQL执行失败:', error);
      return;
    }
    
    console.log('✅ SQL执行成功');
    
    // 验证部署
    console.log('🔍 验证部署...');
    
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('count');
    
    if (achievementsError) {
      console.error('❌ 验证成就表失败:', achievementsError);
      return;
    }
    
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('count');
    
    if (badgesError) {
      console.error('❌ 验证勋章表失败:', badgesError);
      return;
    }
    
    const { data: frames, error: framesError } = await supabase
      .from('avatar_frames')
      .select('count');
    
    if (framesError) {
      console.error('❌ 验证头像框表失败:', framesError);
      return;
    }
    
    console.log('✅ 部署验证成功!');
    console.log(`📊 成就数量: ${achievements.length}`);
    console.log(`🏅 勋章数量: ${badges.length}`);
    console.log(`🖼️ 头像框数量: ${frames.length}`);
    
  } catch (error) {
    console.error('❌ 部署失败:', error);
  }
}

// 运行部署
deployAchievementSystem(); 