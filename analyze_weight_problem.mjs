// 分析metro_complete_adjacency视图中的权重问题
// 理解为什么算法选择换乘路径而不是直达路径

const SUPABASE_URL = 'http://47.123.26.25:8000';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

async function analyzeWeightProblem() {
  console.log('🔍 分析metro_complete_adjacency视图中的权重问题...\n');

  try {
    // 1. 分析上海南站的所有连接
    console.log('1️⃣ 分析上海南站的所有连接...');
    
    const shanghaiNanResponse = await fetch(`${SUPABASE_URL}/rest/v1/metro_complete_adjacency?or=(station_name.eq.上海南站,next_station.eq.上海南站)&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (shanghaiNanResponse.ok) {
      const shanghaiNanData = await shanghaiNanResponse.json();
      console.log(`✅ 上海南站的连接数据: ${shanghaiNanData.length} 条`);
      
      // 分类显示连接
      const sameLineConnections = shanghaiNanData.filter(conn => conn.connection_type === 'same_line');
      const transferConnections = shanghaiNanData.filter(conn => conn.connection_type === 'transfer');
      
      console.log('\n🚇 同线路连接:');
      sameLineConnections.forEach((conn, index) => {
        console.log(`   ${index + 1}. ${conn.station_name} → ${conn.next_station} (${conn.line_info}, ${conn.travel_time}分钟)`);
      });
      
      console.log('\n🔄 换乘连接:');
      transferConnections.forEach((conn, index) => {
        console.log(`   ${index + 1}. ${conn.station_name} → ${conn.next_station} (${conn.line_info}, ${conn.travel_time}分钟)`);
      });
      
      // 分析权重
      console.log('\n🔍 权重分析:');
      console.log('   同线路连接权重: 3分钟/站');
      console.log('   换乘连接权重: 2分钟/次');
      
      // 计算3号线直达路径的权重
      const line3DirectWeight = 7 * 3; // 7站 × 3分钟
      console.log(`   3号线直达路径权重: ${line3DirectWeight}分钟`);
      
      // 计算换乘路径的权重
      const transferPathWeight = 6 * 3 + 2 * 2; // 6站 × 3分钟 + 2次换乘 × 2分钟
      console.log(`   换乘路径权重: ${transferPathWeight}分钟`);
      
      if (line3DirectWeight < transferPathWeight) {
        console.log('   ✅ 3号线直达路径权重更低，应该被选择');
      } else {
        console.log('   ❌ 换乘路径权重更低，这就是问题所在！');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 分析算法选择的换乘路径
    console.log('2️⃣ 分析算法选择的换乘路径...');
    
    const algorithmResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calculate_metro_commute_time`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_start_station: '上海南站',
        p_end_station: '中山公园'
      })
    });
    
    if (algorithmResponse.ok) {
      const algorithmResult = await algorithmResponse.json();
      
      if (algorithmResult && algorithmResult.success) {
        console.log('📊 算法选择的路径分析:');
        console.log(`   路径: ${algorithmResult.path.join(' → ')}`);
        console.log(`   站点数: ${algorithmResult.stations_count}`);
        console.log(`   换乘次数: ${algorithmResult.transfer_count}`);
        console.log(`   总时间: ${algorithmResult.total_time_minutes}分钟`);
        
        // 分析每个站点的连接
        console.log('\n🔍 逐站分析连接:');
        for (let i = 0; i < algorithmResult.path.length - 1; i++) {
          const currentStation = algorithmResult.path[i];
          const nextStation = algorithmResult.path[i + 1];
          
          // 查找这个连接在metro_complete_adjacency中的权重
          const connectionResponse = await fetch(`${SUPABASE_URL}/rest/v1/metro_complete_adjacency?and=(station_name.eq.${encodeURIComponent(currentStation)},next_station.eq.${encodeURIComponent(nextStation)})&select=*`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (connectionResponse.ok) {
            const connectionData = await connectionResponse.json();
            if (connectionData.length > 0) {
              const conn = connectionData[0];
              console.log(`   ${i + 1}. ${currentStation} → ${nextStation}: ${conn.connection_type}, ${conn.travel_time}分钟, ${conn.line_info}`);
            } else {
              console.log(`   ${i + 1}. ${currentStation} → ${nextStation}: 连接未找到`);
            }
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. 分析问题根源
    console.log('3️⃣ 分析问题根源...');
    console.log('🔍 可能的问题:');
    console.log('   1. 3号线直达路径在metro_complete_adjacency中可能不完整');
    console.log('   2. 换乘路径的权重计算可能有问题');
    console.log('   3. Dijkstra算法可能没有找到3号线直达路径');
    
    console.log('\n💡 建议的解决方案:');
    console.log('   1. 检查3号线直达路径在metro_complete_adjacency中是否完整');
    console.log('   2. 验证换乘权重的计算是否正确');
    console.log('   3. 可能需要进一步降低换乘权重');
    console.log('   4. 或者检查Dijkstra算法的实现');

  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
  }
}

// 运行分析
analyzeWeightProblem();
