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

async function checkDealsActualFields(client) {
  console.log('\n===== 检查 deals 表实际字段 =====');
  try {
    // 检查 deals 表所有字段
    const { rows: allColumns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'deals' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 deals 表所有字段:', allColumns.map(c => c.column_name));

    // 检查 deals 表数据（只选择存在的字段）
    const { rows: dealsData, rowCount } = await client.query(`
      SELECT id, leadid, contractdate, community, contractnumber, roomnumber, created_at
      FROM deals 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log(`✅ deals 记录数: ${rowCount}`);
    console.log('📋 deals 数据:', dealsData);

    // 检查是否有外键关联
    const { rows: foreignKeys } = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'deals';
    `);
    console.log('🔗 deals 外键约束:', foreignKeys);

  } catch (err) {
    console.error('❌ 检查失败:', err.message);
  }
}

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✅ 已连接Supabase数据库');
    await checkDealsActualFields(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 