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

async function checkFollowupsStructure(client) {
  console.log('\n===== 检查 followups 表结构 =====');
  try {
    // 检查 followups 表结构
    const { rows: followupsColumns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'followups' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 followups 表结构:', followupsColumns);

    // 检查 followups 表数据
    const { rows: followupsData, rowCount } = await client.query(`
      SELECT leadid, phone, wechat, source, leadstatus, leadtype
      FROM followups 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log(`✅ followups 记录数: ${rowCount}`);
    console.log('📋 followups 数据:', followupsData);

  } catch (err) {
    console.error('❌ 检查失败:', err.message);
  }
}

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ 已连接Supabase数据库');
    await checkFollowupsStructure(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 