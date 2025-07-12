import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function testTables() {
  const tables = [
    'user_points_wallet',
    'user_points_transactions',
    'points_rules',
    'points_exchange_records'
  ];
  for (const table of tables) {
    const res = await executeQuery(`SELECT to_regclass('public.${table}') as exists;`);
    if (res.success && res.data[0].exists) {
      console.log(`✅ 表 ${table} 存在`);
    } else {
      console.error(`❌ 表 ${table} 不存在`);
    }
  }
}

async function testFunctions() {
  const functions = [
    'award_points',
    'exchange_points',
    'get_user_points_info',
    'update_user_points_wallet'
  ];
  for (const func of functions) {
    const res = await executeQuery(`SELECT proname FROM pg_proc WHERE proname = $1;`, [func]);
    if (res.success && res.data.length > 0) {
      console.log(`✅ 函数 ${func} 存在`);
    } else {
      console.error(`❌ 函数 ${func} 不存在`);
    }
  }
}

async function testInitialRules() {
  const res = await executeQuery(`SELECT rule_name, source_type, points_value FROM points_rules ORDER BY id;`);
  if (res.success && res.data.length > 0) {
    console.log('✅ 初始积分规则如下:');
    res.data.forEach(r => {
      console.log(`  - ${r.rule_name} (${r.source_type}): ${r.points_value}`);
    });
  } else {
    console.error('❌ 未找到初始积分规则');
  }
}

async function testAwardAndQuery() {
  // 创建测试用户ID
  const testUserId = 99999999;
  // 清理测试数据
  await executeQuery('DELETE FROM user_points_transactions WHERE user_id = $1', [testUserId]);
  await executeQuery('DELETE FROM user_points_wallet WHERE user_id = $1', [testUserId]);

  // 测试发放积分
  const awardRes = await executeQuery(`SELECT award_points($1, 'SIGNIN', NULL, '测试签到') as result;`, [testUserId]);
  if (awardRes.success && awardRes.data[0].result.success) {
    console.log('✅ award_points 测试通过:', awardRes.data[0].result);
  } else {
    console.error('❌ award_points 测试失败:', awardRes.data[0]?.result || awardRes.error);
  }

  // 查询用户积分信息
  const infoRes = await executeQuery(`SELECT get_user_points_info($1) as info;`, [testUserId]);
  if (infoRes.success) {
    console.log('✅ get_user_points_info 测试通过:', infoRes.data[0].info);
  } else {
    console.error('❌ get_user_points_info 测试失败:', infoRes.error);
  }
}

async function testExchange() {
  const testUserId = 99999999;
  // 先给用户发放积分
  await executeQuery(`SELECT award_points($1, 'DEAL', NULL, '测试成交')`, [testUserId]);
  // 测试兑换
  const exchangeRes = await executeQuery(`SELECT exchange_points($1, 'EXCHANGE_LEAD', 12345, 30, '测试兑换') as result;`, [testUserId]);
  if (exchangeRes.success && exchangeRes.data[0].result.success) {
    console.log('✅ exchange_points 测试通过:', exchangeRes.data[0].result);
  } else {
    console.error('❌ exchange_points 测试失败:', exchangeRes.data[0]?.result || exchangeRes.error);
  }
}

async function main() {
  console.log('🔍 开始测试积分系统...');
  const connected = await connectDB();
  if (!connected) return;
  try {
    await testTables();
    await testFunctions();
    await testInitialRules();
    await testAwardAndQuery();
    await testExchange();
  } finally {
    await closeConnection();
  }
  console.log('🎉 积分系统测试完成！');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 