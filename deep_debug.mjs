// 深入调试Dijkstra函数列引用歧义问题
// 用于找出问题的确切位置

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDebug() {
  console.log('🔍 深入调试Dijkstra函数列引用歧义问题...\n');

  try {
    // 1. 检查函数是否真的被更新了
    console.log('1️⃣ 检查函数是否被更新...');
    
    // 尝试调用函数，看看错误信息是否有变化
    const { data: functionTest, error: functionError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '人民广场'
      });
    
    if (functionError) {
      console.log('❌ 函数调用错误:', functionError.message);
      console.log('🔍 错误详情:', functionError);
    } else {
      console.log('✅ 函数调用成功');
    }

    // 2. 检查视图数据是否包含人民广场
    console.log('\n2️⃣ 检查视图数据...');
    
    // 检查metro_adjacency_view中是否有人民广场
    const { data: adjacencyData, error: adjacencyError } = await supabase
      .from('metro_adjacency_view')
      .select('*')
      .or('station_name.eq.人民广场,next_station.eq.人民广场')
      .limit(10);
    
    if (adjacencyError) {
      console.log('❌ 查询metro_adjacency_view错误:', adjacencyError.message);
    } else {
      console.log('✅ metro_adjacency_view查询成功，数据条数:', adjacencyData.length);
      if (adjacencyData.length > 0) {
        console.log('包含人民广场的数据:', adjacencyData);
      } else {
        console.log('⚠️  metro_adjacency_view中没有找到人民广场');
      }
    }

    // 3. 检查metro_complete_adjacency中是否有人民广场
    const { data: completeData, error: completeError } = await supabase
      .from('metro_complete_adjacency')
      .select('*')
      .or('station_name.eq.人民广场,next_station.eq.人民广场')
      .limit(10);
    
    if (completeError) {
      console.log('❌ 查询metro_complete_adjacency错误:', completeError.message);
    } else {
      console.log('✅ metro_complete_adjacency查询成功，数据条数:', completeData.length);
      if (completeData.length > 0) {
        console.log('包含人民广场的数据:', completeData);
      } else {
        console.log('⚠️  metro_complete_adjacency中没有找到人民广场');
      }
    }

    // 4. 检查metrostations表中是否有人民广场
    console.log('\n3️⃣ 检查metrostations表...');
    const { data: metroData, error: metroError } = await supabase
      .from('metrostations')
      .select('*')
      .eq('name', '人民广场')
      .limit(10);
    
    if (metroError) {
      console.log('❌ 查询metrostations表错误:', metroError.message);
    } else {
      console.log('✅ metrostations表查询成功，数据条数:', metroData.length);
      if (metroData.length > 0) {
        console.log('人民广场数据:', metroData);
      } else {
        console.log('⚠️  metrostations表中没有找到人民广场');
      }
    }

    // 5. 尝试使用其他站点进行测试
    console.log('\n4️⃣ 尝试其他站点...');
    
    // 使用已知存在的站点
    const { data: otherTest, error: otherError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '航中路',
        p_end_station: '紫藤路'
      });
    
    if (otherError) {
      console.log('❌ 其他站点测试失败:', otherError.message);
    } else {
      console.log('✅ 其他站点测试成功，结果数量:', otherTest ? otherTest.length : 0);
    }

    // 6. 分析问题根源
    console.log('\n📊 问题分析:');
    console.log('🔍 可能的原因:');
    console.log('   1. 函数更新失败 - 检查函数是否真的被重新创建');
    console.log('   2. 视图数据问题 - 人民广场可能不在视图中');
    console.log('   3. 权限问题 - 函数可能没有正确的执行权限');
    console.log('   4. 缓存问题 - 数据库可能还在使用旧版本的函数');
    
    console.log('\n💡 建议的解决步骤:');
    console.log('   1. 在Supabase Studio中检查函数是否真的被更新');
    console.log('   2. 检查metro_adjacency_view是否包含人民广场');
    console.log('   3. 如果视图数据不完整，需要重新生成视图数据');
    console.log('   4. 尝试使用已知存在的站点进行测试');

  } catch (error) {
    console.error('❌ 深入调试过程中发生错误:', error);
  }
}

// 运行深入调试
deepDebug();
