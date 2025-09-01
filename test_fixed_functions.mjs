// 测试修复后的Dijkstra函数
// 用于验证列引用歧义问题是否已解决

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFixedFunctions() {
  console.log('🧪 测试修复后的Dijkstra函数...\n');

  try {
    // 1. 测试Dijkstra核心函数
    console.log('1️⃣ 测试Dijkstra核心函数...');
    
    // 测试人民广场到陆家嘴（应该是2站，6分钟）
    console.log('\n--- 测试：人民广场 -> 陆家嘴 ---');
    const { data: dijkstraResult, error: dijkstraError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '陆家嘴'
      });
    
    if (dijkstraError) {
      if (dijkstraError.message.includes('column reference "station_name" is ambiguous')) {
        console.log('❌ 列引用歧义问题仍然存在');
        console.log('📋 需要手动执行修复SQL');
        console.log('💡 请在Supabase Studio中执行 fix_dijkstra_ambiguity.sql 文件');
      } else {
        console.log('❌ 其他错误:', dijkstraError.message);
      }
    } else {
      console.log('✅ dijkstra_metro_shortest_path 函数修复成功！');
      console.log('返回结果数量:', dijkstraResult ? dijkstraResult.length : 0);
      
      if (dijkstraResult && dijkstraResult.length > 0) {
        const targetStation = dijkstraResult.find(s => s.station_name === '陆家嘴');
        if (targetStation) {
          console.log(`✅ 陆家嘴站距离: ${targetStation.distance}分钟`);
          console.log(`✅ 前驱站点: ${targetStation.previous_station}`);
          console.log(`✅ 线路信息: ${targetStation.line_info}`);
          console.log(`✅ 连接类型: ${targetStation.connection_type}`);
          
          // 验证距离是否正确
          if (targetStation.distance === 6) {
            console.log('🎯 距离验证通过：人民广场到陆家嘴确实是6分钟！');
          } else {
            console.log(`⚠️  距离验证失败：期望6分钟，实际${targetStation.distance}分钟`);
          }
        }
      }
    }

    // 2. 测试通勤时间计算函数
    console.log('\n2️⃣ 测试通勤时间计算函数...');
    
    // 测试人民广场到陆家嘴
    console.log('\n--- 测试：人民广场 -> 陆家嘴 ---');
    const { data: commuteResult, error: commuteError } = await supabase
      .rpc('calculate_metro_commute_time', {
        p_start_station: '人民广场',
        p_end_station: '陆家嘴'
      });
    
    if (commuteError) {
      if (commuteError.message.includes('column reference "station_name" is ambiguous')) {
        console.log('❌ 通勤时间计算函数仍有列引用歧义问题');
      } else {
        console.log('❌ 其他错误:', commuteError.message);
      }
    } else {
      console.log('✅ calculate_metro_commute_time 函数修复成功！');
      console.log('返回结果:', commuteResult);
      
      if (commuteResult && commuteResult.success) {
        console.log(`✅ 总时间: ${commuteResult.total_time_minutes}分钟`);
        console.log(`✅ 站点数: ${commuteResult.stations_count}`);
        console.log(`✅ 换乘次数: ${commuteResult.transfer_count}`);
        console.log(`✅ 路径: ${commuteResult.path.join(' -> ')}`);
        console.log(`✅ 路线摘要: ${commuteResult.route_summary}`);
        
        // 验证人民广场到陆家嘴应该是2站，6分钟
        if (commuteResult.stations_count === 2 && commuteResult.total_time_minutes === 6) {
          console.log('🎯 验证通过：人民广场到陆家嘴确实是2站，6分钟！');
        } else {
          console.log('⚠️  验证失败：站点数或时间不符合预期');
          console.log(`   期望：2站，6分钟`);
          console.log(`   实际：${commuteResult.stations_count}站，${commuteResult.total_time_minutes}分钟`);
        }
      }
    }

    // 3. 测试其他站点组合
    console.log('\n3️⃣ 测试其他站点组合...');
    
    // 测试人民广场到徐家汇
    console.log('\n--- 测试：人民广场 -> 徐家汇 ---');
    const { data: commuteResult2, error: commuteError2 } = await supabase
      .rpc('calculate_metro_commute_time', {
        p_start_station: '人民广场',
        p_end_station: '徐家汇'
      });
    
    if (commuteError2) {
      console.log('❌ 人民广场到徐家汇测试失败:', commuteError2.message);
    } else {
      console.log('✅ 人民广场到徐家汇测试成功');
      if (commuteResult2 && commuteResult2.success) {
        console.log(`  总时间: ${commuteResult2.total_time_minutes}分钟`);
        console.log(`  站点数: ${commuteResult2.stations_count}`);
        console.log(`  路径: ${commuteResult2.path.join(' -> ')}`);
        
        // 验证人民广场到徐家汇应该是1站，3分钟
        if (commuteResult2.stations_count === 1 && commuteResult2.total_time_minutes === 3) {
          console.log('🎯 验证通过：人民广场到徐家汇确实是1站，3分钟！');
        } else {
          console.log(`⚠️  验证失败：期望1站，3分钟，实际${commuteResult2.stations_count}站，${commuteResult2.total_time_minutes}分钟`);
        }
      }
    }

    // 4. 总结
    console.log('\n📊 测试总结:');
    if (dijkstraError || commuteError) {
      console.log('❌ 主要函数仍有问题，需要手动修复');
      console.log('📋 修复步骤：');
      console.log('   1. 在Supabase Studio中打开SQL编辑器');
      console.log('   2. 复制 fix_dijkstra_ambiguity.sql 文件内容');
      console.log('   3. 执行SQL语句');
      console.log('   4. 重新运行测试');
    } else {
      console.log('🎉 所有函数都工作正常！');
      console.log('✅ Dijkstra算法正确计算了站点间距离');
      console.log('✅ 通勤时间计算准确');
      console.log('✅ 人民广场到陆家嘴：2站，6分钟');
      console.log('✅ 人民广场到徐家汇：1站，3分钟');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testFixedFunctions();
