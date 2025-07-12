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

async function testPointsAllocationSystem(client) {
  console.log('\n===== 积分分配系统自动化测试 =====');
  try {
    // 1. 创建测试用户与钱包
    await client.query(`INSERT INTO users_profile (id, nickname) VALUES (10001, '测试用户A') ON CONFLICT DO NOTHING;`);
    await client.query(`UPDATE users_profile SET status = 'active' WHERE id = 10001;`);
    await client.query(`INSERT INTO user_points_wallet (user_id, total_points) VALUES (10001, 100) ON CONFLICT (user_id) DO UPDATE SET total_points = 100;`);
    console.log('✅ 测试用户与钱包准备完成');

    // 2. 配置积分成本规则
    await client.query(`INSERT INTO lead_points_cost (name, base_points_cost, is_active) VALUES ('普通', 10, true);`);
    console.log('✅ 积分成本规则配置完成');

    // 3. 插入测试线索并触发分配
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus) VALUES ('TEST20017', '普通', '新分配') ON CONFLICT DO NOTHING;`);
    console.log('✅ 测试线索插入并分配');

    // 4. 检查分配日志与积分扣除
    const log1 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST20017';`);
    const wallet1 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    const tx1 = await client.query(`SELECT * FROM user_points_transactions WHERE user_id = 10001 ORDER BY created_at DESC LIMIT 5;`);
    console.log('\n📋 分配日志:', log1.rows);
    console.log('💰 用户积分余额:', wallet1.rows);
    console.log('🧾 积分扣除流水:', tx1.rows);

    // 5. 积分不足场景测试
    await client.query(`UPDATE user_points_wallet SET total_points = 5 WHERE user_id = 10001;`);
    await client.query(`INSERT INTO leads (leadid, leadtype, leadstatus) VALUES ('TEST20018', '普通', '新分配') ON CONFLICT DO NOTHING;`);
    const log2 = await client.query(`SELECT * FROM simple_allocation_logs WHERE leadid = 'TEST20018';`);
    const wallet2 = await client.query(`SELECT * FROM user_points_wallet WHERE user_id = 10001;`);
    const tx2 = await client.query(`SELECT * FROM user_points_transactions WHERE user_id = 10001 ORDER BY created_at DESC LIMIT 5;`);
    console.log('\n📋 积分不足分配日志:', log2.rows);
    console.log('💰 用户积分余额:', wallet2.rows);
    console.log('🧾 积分扣除流水:', tx2.rows);

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
    await testPointsAllocationSystem(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 