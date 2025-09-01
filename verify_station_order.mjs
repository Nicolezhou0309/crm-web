// 验证metrostations表中ID是否真的按照地铁线路的实际站点顺序排列
// 检查为什么ROW_NUMBER()会产生错误的连接关系

const SUPABASE_URL = 'http://47.123.26.25:8000';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

async function verifyStationOrder() {
  console.log('🔍 验证metrostations表中ID是否真的按照地铁线路的实际站点顺序排列...\n');

  try {
    // 1. 检查3号线的ID顺序
    console.log('1️⃣ 检查3号线的ID顺序...');
    
    const line3Response = await fetch(`${SUPABASE_URL}/rest/v1/metrostations?line=eq.3号线&select=*&order=id.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (line3Response.ok) {
      const line3Data = await line3Response.json();
      console.log(`✅ 3号线站点数据: ${line3Data.length} 条`);
      
      console.log('\n📋 3号线站点ID顺序:');
      line3Data.forEach((station, index) => {
        console.log(`   ${index + 1}. ID ${station.id}: ${station.name}`);
      });
      
      // 检查关键站点的ID顺序
      const keyStations = ['上海南站', '石龙路', '龙漕路', '漕溪路', '宜山路', '虹桥路', '延安西路', '中山公园'];
      console.log('\n🔍 关键站点ID顺序检查:');
      keyStations.forEach(stationName => {
        const station = line3Data.find(s => s.name === stationName);
        if (station) {
          console.log(`   ${stationName}: ID ${station.id}`);
        } else {
          console.log(`   ${stationName}: ❌ 未找到`);
        }
      });
      
      // 分析ID顺序是否正确
      console.log('\n🔍 ID顺序分析:');
      const expectedOrder = ['上海南站', '石龙路', '龙漕路', '漕溪路', '宜山路', '虹桥路', '延安西路', '中山公园'];
      let isOrderCorrect = true;
      
      for (let i = 0; i < expectedOrder.length - 1; i++) {
        const currentStation = line3Data.find(s => s.name === expectedOrder[i]);
        const nextStation = line3Data.find(s => s.name === expectedOrder[i + 1]);
        
        if (currentStation && nextStation) {
          if (currentStation.id >= nextStation.id) {
            console.log(`   ❌ ${expectedOrder[i]}(ID ${currentStation.id}) 应该在 ${expectedOrder[i + 1]}(ID ${nextStation.id}) 之前`);
            isOrderCorrect = false;
          } else {
            console.log(`   ✅ ${expectedOrder[i]}(ID ${currentStation.id}) → ${expectedOrder[i + 1]}(ID ${nextStation.id}) 顺序正确`);
          }
        }
      }
      
      if (isOrderCorrect) {
        console.log('\n✅ ID顺序正确，问题可能在ROW_NUMBER()计算上');
      } else {
        console.log('\n❌ ID顺序不正确，这就是问题根源！');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 检查1号线的ID顺序（作为对比）
    console.log('2️⃣ 检查1号线的ID顺序（作为对比）...');
    
    const line1Response = await fetch(`${SUPABASE_URL}/rest/v1/metrostations?line=eq.1号线&select=*&order=id.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (line1Response.ok) {
      const line1Data = await line1Response.json();
      console.log(`✅ 1号线站点数据: ${line1Data.length} 条`);
      
      console.log('\n📋 1号线站点ID顺序（前10个）:');
      line1Data.slice(0, 10).forEach((station, index) => {
        console.log(`   ${index + 1}. ID ${station.id}: ${station.name}`);
      });
      
      // 检查1号线的关键站点顺序
      const line1KeyStations = ['莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇'];
      console.log('\n🔍 1号线关键站点ID顺序检查:');
      line1KeyStations.forEach(stationName => {
        const station = line1Data.find(s => s.name === stationName);
        if (station) {
          console.log(`   ${stationName}: ID ${station.id}`);
        } else {
          console.log(`   ${stationName}: ❌ 未找到`);
        }
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. 分析问题根源
    console.log('3️⃣ 分析问题根源...');
    console.log('🔍 从截图发现的问题:');
    console.log('   1. 虹桥路 → 宜山路: 这个连接看起来正确');
    console.log('   2. 虹桥路 → 延安西路: ❌ 这个连接错误！');
    console.log('   3. 龙漕路 → 石龙路: ❌ 这个连接错误！');
    
    console.log('\n💡 可能的原因:');
    console.log('   1. metrostations表中的ID顺序不正确');
    console.log('   2. 某些站点的ID被错误设置');
    console.log('   3. 数据导入时站点顺序混乱');
    
    console.log('\n🔧 建议的解决方案:');
    console.log('   1. 检查metrostations表的原始数据');
    console.log('   2. 重新整理站点ID，确保按照实际线路顺序');
    console.log('   3. 或者修改视图逻辑，不依赖ID顺序');

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
  }
}

// 运行验证
verifyStationOrder();
