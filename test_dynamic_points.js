import { Client } from 'pg';

const config = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.wteqgprgiylmxzszcnws',
  password: 'gAC5Yqi01wh3eISR',
  ssl: { rejectUnauthorized: false }
};

async function testDynamicPointsRules(client) {
  console.log('\n===== 动态积分规则测试 =====');
  try {
    // 1. 准备测试用户
    await client.query(`INSERT INTO users_profile (id, nickname) VALUES (10001, '测试用户A') ON CONFLICT DO NOTHING;`);
    await client.query(`UPDATE users_profile SET status = 'active' WHERE id = 10001;`);
    await client.query(`INSERT INTO user_points_wallet (user_id, total_points) VALUES (10001, 500) ON CONFLICT (user_id) DO UPDATE SET total_points = 500;`);
    console.log('✅ 测试用户准备完成');

    // 2. 测试1: 抖音来源动态规则
    console.log('\n📱 测试1: 抖音来源动态规则');
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus, source) VALUES ('TEST30013', '普通', '新分配', '抖音') ON CONFLICT DO NOTHING;`);
    const log1 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST30013';`);
    const wallet1 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    console.log('分配日志:', log1.rows);
    console.log('用户积分余额:', wallet1.rows);

    // 3. 测试2: 关键词动态规则 - 别墅
    console.log('\n🏠 测试2: 关键词动态规则 - 别墅');
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus, remark) VALUES ('TEST30014', '普通', '新分配', '客户想买别墅') ON CONFLICT DO NOTHING;`);
    const log2 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST30014';`);
    const wallet2 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    console.log('分配日志:', log2.rows);
    console.log('用户积分余额:', wallet2.rows);

    // 4. 测试3: 关键词动态规则 - 豪宅
    console.log('\n🏰 测试3: 关键词动态规则 - 豪宅');
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus, remark) VALUES ('TEST30015', '普通', '新分配', '寻找豪宅') ON CONFLICT DO NOTHING;`);
    const log3 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST30015';`);
    const wallet3 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    console.log('分配日志:', log3.rows);
    console.log('用户积分余额:', wallet3.rows);

    // 5. 测试4: 时间动态规则 - 周末
    console.log('\n⏰ 测试4: 时间动态规则 - 周末');
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus) VALUES ('TEST30016', '普通', '新分配') ON CONFLICT DO NOTHING;`);
    const log4 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST30016';`);
    const wallet4 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    console.log('分配日志:', log4.rows);
    console.log('用户积分余额:', wallet4.rows);

    // 6. 测试5: 组合动态规则 - 抖音+别墅
    console.log('\n🎯 测试5: 组合动态规则 - 抖音+别墅');
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus, source, remark) VALUES ('TEST30017', '普通', '新分配', '抖音', '抖音客户想买别墅') ON CONFLICT DO NOTHING;`);
    const log5 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST30017';`);
    const wallet5 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    console.log('分配日志:', log5.rows);
    console.log('用户积分余额:', wallet5.rows);

    // 7. 检查积分交易记录
    console.log('\n💰 积分交易记录:');
    const transactions = await client.query(`SELECT * FROM user_points_transactions WHERE user_id = 10001 ORDER BY created_at DESC LIMIT 10;`);
    console.log('交易记录:', transactions.rows);

    console.log('\n===== 动态积分规则测试完成 =====');
  } catch (err) {
    console.error('❌ 测试执行出错:', err.message);
  }
}

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ 已连接Supabase数据库');
    await testDynamicPointsRules(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 