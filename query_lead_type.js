import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://postgres.wteqgprgiylmxzszcnws:gAC5Yqi01wh3eISR@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const leadid = '25Y00016';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT leadid, leadtype, * FROM leads WHERE leadid = $1`,
      [leadid]
    );
    if (res.rows.length === 0) {
      console.log('未找到该线索');
      return;
    }
    const lead = res.rows[0];
    console.log('线索ID:', lead.leadid);
    console.log('leadtype 字段实际值:', lead.leadtype);
    console.log('完整记录:', lead);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('查询出错:', e);
}); 