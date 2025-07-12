import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://postgres.wteqgprgiylmxzszcnws:gAC5Yqi01wh3eISR@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const testLeadId = 'TEST_NULLTYPE_' + Date.now();

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // 1. 插入测试线索（leadtype为null）
    await client.query(
      `INSERT INTO leads (leadid, source, remark, created_at, updata_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [testLeadId, '小红书', '[COMMUNITY:浦江公园社区]']
    );
    console.log('已插入测试线索:', testLeadId);

    // 2. 等待触发器分配（延迟1秒）
    await new Promise(res => setTimeout(res, 1000));

    // 3. 查询分配日志
    const logRes = await client.query(
      `SELECT * FROM simple_allocation_logs WHERE leadid = $1 ORDER BY created_at DESC LIMIT 1`,
      [testLeadId]
    );
    if (logRes.rows.length === 0) {
      console.log('未找到分配日志');
      return;
    }
    const log = logRes.rows[0];
    console.log('\n分配日志processing_details:');
    console.dir(log.processing_details, { depth: 10 });

    // 4. 提取分配参数
    const allocationResult = log.processing_details?.allocation_result;
    if (allocationResult) {
      console.log('\n分配debug_info:');
      console.dir(allocationResult.debug_info, { depth: 10 });
      console.log('分配时input_leadtype:', allocationResult.debug_info?.input_leadtype);
      console.log('命中规则ID:', allocationResult.rule_id);
      console.log('命中规则名称:', allocationResult.rule_name);
      console.log('积分成本:', allocationResult.points_cost);
    } else {
      console.log('未找到allocation_result');
    }
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('自动化测试出错:', e);
}); 