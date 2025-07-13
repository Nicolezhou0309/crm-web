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

async function checkDealsStructure(client) {
  console.log('\n===== 检查 deals 表结构 =====');
  try {
    // 检查 deals 表结构
    const { rows: dealsColumns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'deals' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 deals 表结构:', dealsColumns);

    // 检查 deals 表数据
    const { rows: dealsData, rowCount } = await client.query(`
      SELECT id, leadid, contractdate, interviewsales, interviewsales_user_id, community, contractnumber, roomnumber, created_at
      FROM deals 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log(`✅ deals 记录数: ${rowCount}`);
    console.log('📋 deals 数据:', dealsData);

    // 测试现有的 filter_deals 函数
    console.log('\n🔍 测试现有的 filter_deals 函数...');
    const { rows: filterResult } = await client.query(`
      SELECT * FROM filter_deals() LIMIT 3;
    `);
    console.log('✅ filter_deals 结果:', filterResult.length, '条记录');

  } catch (err) {
    console.error('❌ 检查失败:', err.message);
  }
}

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ 已连接Supabase数据库');
    await checkDealsStructure(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 