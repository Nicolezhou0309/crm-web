import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseFunctions() {
  console.log('🔍 开始诊断Dijkstra函数问题...\n');

  try {
    // 1. 检查函数是否存在
    console.log('1️⃣ 检查函数是否存在...');
    
    // 尝试调用Dijkstra函数
    const { data: dijkstraData, error: dijkstraError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '莘庄',
        p_end_station: '外环路'
      });
    
    if (dijkstraError) {
      console.log('❌ Dijkstra函数错误详情:');
      console.log('   错误代码:', dijkstraError.code);
      console.log('   错误消息:', dijkstraError.message);
      console.log('   错误详情:', dijkstraError.details);
      console.log('   错误提示:', dijkstraError.hint);
    } else {
      console.log('✅ Dijkstra函数工作正常');
    }

    // 2. 检查通勤时间计算函数
    console.log('\n2️⃣ 检查通勤时间计算函数...');
    
    const { data: commuteData, error: commuteError } = await supabase
      .rpc('calculate_metro_commute_time', {
        p_start_station: '莘庄',
        p_end_station: '外环路'
      });
    
    if (commuteError) {
      console.log('❌ 通勤时间计算函数错误详情:');
      console.log('   错误代码:', commuteError.code);
      console.log('   错误消息:', commuteError.message);
      console.log('   错误详情:', commuteError.details);
      console.log('   错误提示:', commuteError.hint);
    } else {
      console.log('✅ 通勤时间计算函数工作正常');
    }

    // 3. 检查基础视图
    console.log('\n3️⃣ 检查基础视图...');
    
    const { data: adjacencyData, error: adjacencyError } = await supabase
      .from('metro_adjacency_view')
      .select('*')
      .limit(3);
    
    if (adjacencyError) {
      console.log('❌ metro_adjacency_view 视图错误:', adjacencyError.message);
    } else {
      console.log('✅ metro_adjacency_view 视图正常，数据:', adjacencyData);
    }

    const { data: transferData, error: transferError } = await supabase
      .from('metro_transfer_view')
      .select('*')
      .limit(3);
    
    if (transferError) {
      console.log('❌ metro_transfer_view 视图错误:', transferError.message);
    } else {
      console.log('✅ metro_transfer_view 视图正常，数据:', transferError);
    }

    const { data: completeData, error: completeError } = await supabase
      .from('metro_complete_adjacency')
      .select('*')
      .limit(3);
    
    if (completeError) {
      console.log('❌ metro_complete_adjacency 视图错误:', completeError.message);
    } else {
      console.log('✅ metro_complete_adjacency 视图正常，数据:', completeData);
    }

    // 4. 检查metrostations表
    console.log('\n4️⃣ 检查metrostations表...');
    
    const { data: metroData, error: metroError } = await supabase
      .from('metrostations')
      .select('*')
      .limit(5);
    
    if (metroError) {
      console.log('❌ metrostations 表错误:', metroError.message);
    } else {
      console.log('✅ metrostations 表正常，数据条数:', metroData.length);
      console.log('   示例数据:', metroData.slice(0, 3));
    }

    // 5. 提供修复建议
    console.log('\n📋 诊断结果和建议:');
    
    if (dijkstraError && dijkstraError.message.includes('ambiguous')) {
      console.log('🔴 主要问题：列引用歧义仍然存在');
      console.log('💡 建议：');
      console.log('   1. 检查修复SQL是否正确执行');
      console.log('   2. 确认函数是否被重新创建');
      console.log('   3. 可能需要删除旧函数后重新创建');
    } else if (dijkstraError) {
      console.log('🟡 其他问题：', dijkstraError.message);
    } else {
      console.log('🟢 所有函数工作正常！');
    }

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
diagnoseFunctions();