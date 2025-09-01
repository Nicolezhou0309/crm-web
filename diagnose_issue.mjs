// 诊断Dijkstra函数列引用歧义问题的脚本
// 用于找出问题的根源

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseIssue() {
  console.log('🔍 开始诊断Dijkstra函数列引用歧义问题...\n');

  try {
    // 1. 检查视图是否存在问题
    console.log('1️⃣ 检查地铁邻接关系视图...');
    
    // 检查metro_adjacency_view
    const { data: adjacencyData, error: adjacencyError } = await supabase
      .from('metro_adjacency_view')
      .select('*')
      .limit(5);
    
    if (adjacencyError) {
      console.log('❌ metro_adjacency_view 视图错误:', adjacencyError.message);
    } else {
      console.log('✅ metro_adjacency_view 视图正常，数据条数:', adjacencyData.length);
      console.log('示例数据:', adjacencyData[0]);
    }

    // 检查metro_complete_adjacency
    const { data: completeAdjacencyData, error: completeAdjacencyError } = await supabase
      .from('metro_complete_adjacency')
      .select('*')
      .limit(5);
    
    if (completeAdjacencyError) {
      console.log('❌ metro_complete_adjacency 视图错误:', completeAdjacencyError.message);
    } else {
      console.log('✅ metro_complete_adjacency 视图正常，数据条数:', completeAdjacencyData.length);
      console.log('示例数据:', completeAdjacencyData[0]);
    }

    // 2. 检查函数定义
    console.log('\n2️⃣ 检查函数定义...');
    
    // 尝试获取函数信息
    const { data: functionInfo, error: functionError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '人民广场'  // 使用相同站点避免复杂路径
      });
    
    if (functionError) {
      console.log('❌ 函数调用错误:', functionError.message);
      
      // 分析错误信息
      if (functionError.message.includes('column reference "station_name" is ambiguous')) {
        console.log('🔍 列引用歧义问题分析:');
        console.log('   问题出现在函数内部，可能是视图查询中的列名冲突');
        console.log('   需要检查 metro_adjacency_view 和 metro_complete_adjacency 视图');
      }
    } else {
      console.log('✅ 函数调用成功，返回结果数量:', functionInfo ? functionInfo.length : 0);
    }

    // 3. 检查metrostations表结构
    console.log('\n3️⃣ 检查metrostations表结构...');
    const { data: metroStructure, error: metroStructureError } = await supabase
      .from('metrostations')
      .select('*')
      .limit(1);
    
    if (metroStructureError) {
      console.log('❌ metrostations表访问错误:', metroStructureError.message);
    } else {
      console.log('✅ metrostations表正常');
      if (metroStructure && metroStructure.length > 0) {
        console.log('表结构示例:', Object.keys(metroStructure[0]));
      }
    }

    // 4. 尝试简单的SQL查询来定位问题
    console.log('\n4️⃣ 尝试简单查询定位问题...');
    
    // 检查是否有重复的列名
    const { data: simpleQuery, error: simpleQueryError } = await supabase
      .from('metro_adjacency_view')
      .select('station_name, next_station, line, travel_time')
      .limit(1);
    
    if (simpleQueryError) {
      console.log('❌ 简单查询失败:', simpleQueryError.message);
    } else {
      console.log('✅ 简单查询成功:', simpleQuery);
    }

    // 5. 检查视图定义
    console.log('\n5️⃣ 检查视图定义...');
    console.log('💡 建议在Supabase Studio中执行以下SQL来检查视图定义:');
    console.log('   SELECT schemaname, viewname, definition FROM pg_views WHERE viewname LIKE \'%metro%\';');

    // 6. 总结诊断结果
    console.log('\n📊 诊断总结:');
    console.log('🔍 列引用歧义问题可能出现在以下位置:');
    console.log('   1. metro_adjacency_view 视图定义');
    console.log('   2. metro_complete_adjacency 视图定义');
    console.log('   3. 函数内部的子查询');
    console.log('   4. UNION 查询中的列名冲突');
    
    console.log('\n💡 建议的修复步骤:');
    console.log('   1. 检查所有地铁相关视图的定义');
    console.log('   2. 确保所有列名都有明确的别名');
    console.log('   3. 检查UNION查询中的列名一致性');
    console.log('   4. 重新创建有问题的视图');

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
diagnoseIssue();
