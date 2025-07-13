import { Client } from 'pg';

// Supabase PostgreSQL连接配置
const config = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.wteqgprgiylmxzszcnws',
  password: 'gAC5Yqi01wh3eISR',
  ssl: {
    rejectUnauthorized: false
  }
};

async function testDealsFilter(client) {
  console.log('\n===== 测试成交记录筛选函数 =====');
  try {
    // 1. 测试基本筛选功能
    console.log('🔍 测试基本筛选...');
    const { rows: basicFilter } = await client.query(`
      SELECT * FROM filter_deals(
        p_limit := 5,
        p_order_by := 'created_at',
        p_ascending := false
      );
    `);
    console.log('✅ 基本筛选结果:', basicFilter.length, '条记录');

    // 2. 测试社区筛选
    console.log('\n🔍 测试社区筛选...');
    const { rows: communityFilter } = await client.query(`
      SELECT * FROM filter_deals(
        p_community := ARRAY['测试社区'],
        p_limit := 3
      );
    `);
    console.log('✅ 社区筛选结果:', communityFilter.length, '条记录');

    // 3. 测试合同日期范围筛选
    console.log('\n🔍 测试合同日期范围筛选...');
    const { rows: dateFilter } = await client.query(`
      SELECT * FROM filter_deals(
        p_contractdate_start := '2025-01-01',
        p_limit := 3
      );
    `);
    console.log('✅ 合同日期筛选结果:', dateFilter.length, '条记录');

    // 4. 测试总数统计
    console.log('\n📊 测试总数统计...');
    const { rows: countResult } = await client.query(`
      SELECT get_deals_count() as total_count;
    `);
    console.log('✅ 总记录数:', countResult[0]?.total_count || 0);

    // 5. 测试枚举值获取
    console.log('\n📝 测试枚举值获取...');
    const { rows: communities } = await client.query(`
      SELECT get_deals_community_options() as communities;
    `);
    console.log('✅ 社区枚举:', communities[0]?.communities || []);

    const { rows: sources } = await client.query(`
      SELECT get_deals_source_options() as sources;
    `);
    console.log('✅ 来源枚举:', sources[0]?.sources || []);

    const { rows: contractNumbers } = await client.query(`
      SELECT get_deals_contractnumber_options() as contract_numbers;
    `);
    console.log('✅ 合同编号枚举:', contractNumbers[0]?.contract_numbers || []);

    const { rows: roomNumbers } = await client.query(`
      SELECT get_deals_roomnumber_options() as room_numbers;
    `);
    console.log('✅ 房间编号枚举:', roomNumbers[0]?.room_numbers || []);

    console.log('\n===== 测试完成 =====');
  } catch (err) {
    console.error('❌ 测试执行出错:', err.message);
  }
}

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ 已连接Supabase数据库');
    await testDealsFilter(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 