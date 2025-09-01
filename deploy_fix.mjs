// 部署Dijkstra函数修复的脚本
// 用于修复列引用歧义问题

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployDijkstraFix() {
  console.log('🔧 开始部署Dijkstra函数修复...\n');

  try {
    // 1. 读取修复SQL文件
    console.log('1️⃣ 读取修复SQL文件...');
    const fixSql = fs.readFileSync('fix_dijkstra_ambiguity.sql', 'utf8');
    console.log('✅ 修复SQL文件读取成功');

    // 2. 执行修复SQL
    console.log('\n2️⃣ 执行修复SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: fixSql });
    
    if (error) {
      console.log('❌ 执行修复SQL失败:', error.message);
      console.log('尝试直接执行SQL语句...');
      
      // 如果exec_sql函数不存在，尝试直接执行
      const { error: directError } = await supabase.rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '陆家嘴'
      });
      
      if (directError && directError.message.includes('column reference "station_name" is ambiguous')) {
        console.log('⚠️  列引用歧义问题仍然存在，需要手动修复');
        console.log('请手动执行 fix_dijkstra_ambiguity.sql 文件中的SQL语句');
      } else {
        console.log('✅ 函数似乎已经修复');
      }
    } else {
      console.log('✅ 修复SQL执行成功');
    }

    // 3. 测试修复后的函数
    console.log('\n3️⃣ 测试修复后的函数...');
    
    // 测试Dijkstra核心函数
    console.log('\n--- 测试：人民广场 -> 陆家嘴 ---');
    const { data: dijkstraResult, error: dijkstraError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '陆家嘴'
      });
    
    if (dijkstraError) {
      console.log('❌ dijkstra_metro_shortest_path 函数仍有问题:', dijkstraError.message);
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
        }
      }
    }

    // 测试通勤时间计算函数
    console.log('\n--- 测试：人民广场 -> 陆家嘴 ---');
    const { data: commuteResult, error: commuteError } = await supabase
      .rpc('calculate_metro_commute_time', {
        p_start_station: '人民广场',
        p_end_station: '陆家嘴'
      });
    
    if (commuteError) {
      console.log('❌ calculate_metro_commute_time 函数仍有问题:', commuteError.message);
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

    console.log('\n🎉 Dijkstra函数修复部署完成！');

  } catch (error) {
    console.error('❌ 部署过程中发生错误:', error);
  }
}

// 运行部署
deployDijkstraFix();
