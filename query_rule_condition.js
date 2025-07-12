import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://postgres.wteqgprgiylmxzszcnws:gAC5Yqi01wh3eISR@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const ruleId = '88298a79-938d-4625-a915-4d750a94cdbd';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT id, name, conditions, base_points_cost, priority, is_active FROM lead_points_cost WHERE id = $1`,
      [ruleId]
    );
    if (res.rows.length === 0) {
      console.log('未找到该规则');
      return;
    }
    const rule = res.rows[0];
    console.log('规则信息:');
    console.log('ID:', rule.id);
    console.log('名称:', rule.name);
    console.log('基础积分成本:', rule.base_points_cost);
    console.log('优先级:', rule.priority);
    console.log('是否启用:', rule.is_active);
    console.log('条件(JSON):', JSON.stringify(rule.conditions, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('查询出错:', e);
}); 