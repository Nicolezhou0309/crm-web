// 诊断metro_transfer_view为什么变成空视图
// 检查数据源和过滤逻辑

const SUPABASE_URL = 'http://47.123.26.25:8000';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

async function diagnoseTransferView() {
  console.log('🔍 诊断metro_transfer_view为什么变成空视图...\n');

  try {
    // 1. 检查metrostations表的基础数据
    console.log('1️⃣ 检查metrostations表的基础数据...');
    
    const stationsResponse = await fetch(`${SUPABASE_URL}/rest/v1/metrostations?select=*&limit=20`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (stationsResponse.ok) {
      const stationsData = await stationsResponse.json();
      console.log(`✅ 获取到 ${stationsData.length} 条站点数据`);
      
      // 显示前几条数据
      console.log('\n📋 前5条站点数据:');
      stationsData.slice(0, 5).forEach((station, index) => {
        console.log(`   ${index + 1}. ${station.name} (${station.line})`);
      });
      
      // 检查换乘站（同一站点名对应多条线路）
      const transferStations = {};
      stationsData.forEach(station => {
        if (station.name && station.line) {
          if (!transferStations[station.name]) {
            transferStations[station.name] = [];
          }
          transferStations[station.name].push(station.line);
        }
      });
      
      const multiLineStations = Object.entries(transferStations)
        .filter(([name, lines]) => lines.length > 1)
        .slice(0, 10);
      
      console.log('\n🚇 多线路站点（前10个）:');
      multiLineStations.forEach(([name, lines], index) => {
        console.log(`   ${index + 1}. ${name}: ${lines.join(', ')}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 检查过滤条件是否过于严格
    console.log('2️⃣ 检查过滤条件是否过于严格...');
    
    // 检查宜山路、桂林路、桂林公园的实际线路
    const keyStations = ['宜山路', '桂林路', '桂林公园'];
    
    for (const stationName of keyStations) {
      const stationResponse = await fetch(`${SUPABASE_URL}/rest/v1/metrostations?name=eq.${encodeURIComponent(stationName)}&select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (stationResponse.ok) {
        const stationData = await stationResponse.json();
        console.log(`\n📋 ${stationName} 的线路信息:`);
        if (stationData.length > 0) {
          stationData.forEach((station, index) => {
            console.log(`   ${index + 1}. ${station.name} (${station.line})`);
          });
        } else {
          console.log(`   ❌ 没有找到 ${stationName} 的数据`);
        }
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. 手动测试换乘视图的SQL逻辑
    console.log('3️⃣ 手动测试换乘视图的SQL逻辑...');
    
    // 测试第一步：找出所有换乘站
    const transferStationsResponse = await fetch(`${SUPABASE_URL}/rest/v1/metrostations?select=name,line&name=not.is.null&line=not.is.null&line=neq.未知&line=neq.非地铁`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (transferStationsResponse.ok) {
      const transferStationsData = await transferStationsResponse.json();
      console.log(`✅ 符合条件的站点数据: ${transferStationsData.length} 条`);
      
      // 统计每个站点名对应的线路数
      const stationLineCount = {};
      transferStationsData.forEach(station => {
        if (!stationLineCount[station.name]) {
          stationLineCount[station.name] = 0;
        }
        stationLineCount[station.name]++;
      });
      
      const multiLineStationsCount = Object.values(stationLineCount).filter(count => count > 1).length;
      console.log(`📊 多线路站点数量: ${multiLineStationsCount} 个`);
      
      // 显示一些多线路站点
      const sampleMultiLineStations = Object.entries(stationLineCount)
        .filter(([name, count]) => count > 1)
        .slice(0, 5);
      
      console.log('\n📋 示例多线路站点:');
      sampleMultiLineStations.forEach(([name, count], index) => {
        console.log(`   ${index + 1}. ${name}: ${count} 条线路`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 4. 分析问题根源
    console.log('4️⃣ 分析问题根源...');
    console.log('🔍 可能的问题:');
    console.log('   1. 过滤条件过于严格，把所有换乘关系都过滤掉了');
    console.log('   2. 数据源中可能没有真正的多线路站点');
    console.log('   3. 过滤逻辑可能有语法错误');
    
    console.log('\n💡 建议的解决方案:');
    console.log('   1. 先不添加过滤条件，看看原始数据');
    console.log('   2. 逐步添加过滤条件，确保不会过度过滤');
    console.log('   3. 检查metrostations表的数据质量');

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
diagnoseTransferView();
