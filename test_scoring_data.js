// 测试评分数据
// 这个脚本用于验证数据库中的评分数据

const { createClient } = require('@supabase/supabase-js');

// 请替换为您的Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testScoringData() {
  try {
    console.log('开始测试评分数据...');
    
    // 1. 获取所有数据
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('查询失败:', error);
      return;
    }
    
    console.log('原始数据:', data);
    
    // 2. 检查评分数据
    const scoringData = data.map(item => ({
      id: item.id,
      average_score: item.average_score,
      average_score_type: typeof item.average_score,
      scoring_status: item.scoring_status,
      scored_by: item.scored_by,
      scored_at: item.scored_at
    }));
    
    console.log('评分数据:', scoringData);
    
    // 3. 检查有评分的记录
    const scoredRecords = data.filter(item => item.average_score !== null);
    console.log('有评分的记录数量:', scoredRecords.length);
    console.log('有评分的记录:', scoredRecords);
    
    // 4. 检查数据类型
    const dataTypes = data.map(item => ({
      id: item.id,
      average_score: item.average_score,
      type: typeof item.average_score,
      isNumber: typeof item.average_score === 'number',
      isNull: item.average_score === null,
      isUndefined: item.average_score === undefined
    }));
    
    console.log('数据类型检查:', dataTypes);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testScoringData(); 