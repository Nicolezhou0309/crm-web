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

async function testShowingsFilter(client) {
  console.log('\n===== 测试带看记录筛选函数 =====');
  try {
    // 1. 测试基本筛选功能
    console.log('🔍 测试基本筛选...');
    const { rows: basicFilter } = await client.query(`
      SELECT * FROM filter_showings(
        p_limit := 5,
        p_order_by := 'created_at',
        p_ascending := false
      );
    `);
    console.log('✅ 基本筛选结果:', basicFilter.length, '条记录');

    // 2. 测试带看结果筛选
    console.log('\n🔍 测试带看结果筛选...');
    const { rows: viewResultFilter } = await client.query(`
      SELECT * FROM filter_showings(
        p_viewresult := '满意',
        p_limit := 3
      );
    `);
    console.log('✅ 看房结果筛选结果:', viewResultFilter.length, '条记录');

    // 3. 测试预算范围筛选
    console.log('\n🔍 测试预算范围筛选...');
    const { rows: budgetFilter } = await client.query(`
      SELECT * FROM filter_showings(
        p_budget_min := 1000,
        p_budget_max := 5000,
        p_limit := 3
      );
    `);
    console.log('✅ 预算范围筛选结果:', budgetFilter.length, '条记录');

    // 4. 测试时间范围筛选
    console.log('\n🔍 测试时间范围筛选...');
    const { rows: timeFilter } = await client.query(`
      SELECT * FROM filter_showings(
        p_created_at_start := '2025-01-01T00:00:00Z',
        p_limit := 3
      );
    `);
    console.log('✅ 时间范围筛选结果:', timeFilter.length, '条记录');

    // 5. 测试总数统计
    console.log('\n📊 测试总数统计...');
    const { rows: countResult } = await client.query(`
      SELECT get_showings_count() as total_count;
    `);
    console.log('✅ 总记录数:', countResult[0]?.total_count || 0);

    // 6. 测试枚举值获取
    console.log('\n📝 测试枚举值获取...');
    const { rows: viewResults } = await client.query(`
      SELECT get_showings_viewresult_options() as view_results;
    `);
    console.log('✅ 看房结果枚举:', viewResults[0]?.view_results || []);

    const { rows: communities } = await client.query(`
      SELECT get_showings_community_options() as communities;
    `);
    console.log('✅ 社区枚举:', communities[0]?.communities || []);

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
    await testShowingsFilter(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 