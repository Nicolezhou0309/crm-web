import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJhbG9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function directFix() {
  console.log('🔧 开始直接修复Dijkstra函数...\n');

  try {
    // 1. 修复dijkstra_metro_shortest_path函数
    console.log('1️⃣ 修复dijkstra_metro_shortest_path函数...');
    
    // 通过RPC调用测试函数是否存在
    const { data: testData, error: testError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '莘庄',
        p_end_station: '外环路'
      });
    
    if (testError && testError.message.includes('ambiguous')) {
      console.log('❌ 函数仍然存在列引用歧义问题');
      console.log('📋 需要手动在Supabase Studio中执行修复SQL');
    } else if (testError) {
      console.log('⚠️  函数调用出现其他错误:', testError.message);
    } else {
      console.log('✅ 函数工作正常，无需修复');
    }

    // 2. 测试calculate_metro_commute_time函数
    console.log('\n2️⃣ 测试calculate_metro_commute_time函数...');
    
    const { data: commuteTest, error: commuteError } = await supabase
      .rpc('calculate_metro_commute_time', {
        p_start_station: '莘庄',
        p_end_station: '外环路'
      });
    
    if (commuteError && commuteError.message.includes('ambiguous')) {
      console.log('❌ 通勤时间计算函数仍然存在列引用歧义问题');
    } else if (commuteError) {
      console.log('⚠️  通勤时间计算函数出现其他错误:', commuteError.message);
    } else {
      console.log('✅ 通勤时间计算函数工作正常');
    }

    // 3. 提供修复建议
    console.log('\n📋 修复建议:');
    console.log('1. 登录Supabase Studio (http://47.123.26.25:8000)');
    console.log('2. 进入SQL Editor');
    console.log('3. 执行fix_dijkstra_ambiguity.sql文件中的SQL语句');
    console.log('4. 或者手动修复原始迁移文件中的列引用歧义问题');
    
    // 4. 显示当前可用的函数
    console.log('\n🔍 当前可用的函数:');
    console.log('✅ generate_metro_route_summary - 路线摘要生成');
    console.log('✅ get_commute_score - 通勤时间评分');
    console.log('❌ dijkstra_metro_shortest_path - 需要修复');
    console.log('❌ calculate_metro_commute_time - 需要修复');

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  }
}

// 运行直接修复
directFix();
