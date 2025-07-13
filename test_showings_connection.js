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

async function testShowingsTable(client) {
  console.log('\n===== 带看记录表测试 =====');
  try {
    // 1. 检查表结构
    console.log('📋 检查表结构...');
    const { rows: tableInfo } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'showings' 
      ORDER BY ordinal_position;
    `);
    console.log('✅ 表结构:', tableInfo);

    // 2. 检查外键约束
    console.log('\n🔗 检查外键约束...');
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
        AND tc.table_name = 'showings';
    `);
    console.log('✅ 外键约束:', foreignKeys);

    // 3. 检查现有数据
    console.log('\n📊 检查现有数据...');
    const { rows: existingData, rowCount } = await client.query(`
      SELECT 
        id,
        leadid,
        community,
        viewresult,
        budget,
        renttime,
        created_at
      FROM showings 
      ORDER BY created_at DESC 
      LIMIT 5;
    `);
    console.log(`✅ 现有记录数: ${rowCount}`);
    console.log('📋 最新记录:', existingData);

    // 4. 测试筛选功能
    console.log('\n🔍 测试筛选功能...');
    const { rows: filteredData } = await client.query(`
      SELECT 
        s.id,
        s.leadid,
        s.community,
        s.viewresult,
        s.budget,
        s.renttime,
        sp.nickname as showingsales_name,
        tsp.nickname as trueshowingsales_name,
        f.phone,
        f.wechat
      FROM showings s
      LEFT JOIN users_profile sp ON s.showingsales = sp.id
      LEFT JOIN users_profile tsp ON s.trueshowingsales = tsp.id
      LEFT JOIN followups f ON s.leadid = f.leadid
      WHERE s.budget >= 1000
      ORDER BY s.created_at DESC
      LIMIT 3;
    `);
    console.log('✅ 筛选结果:', filteredData);

    // 5. 检查枚举值
    console.log('\n📝 检查枚举值...');
    const { rows: viewResults } = await client.query(`
      SELECT DISTINCT viewresult 
      FROM showings 
      WHERE viewresult IS NOT NULL 
      ORDER BY viewresult;
    `);
    console.log('✅ 看房结果枚举:', viewResults.map(r => r.viewresult));

    const { rows: communities } = await client.query(`
      SELECT DISTINCT community 
      FROM showings 
      WHERE community IS NOT NULL 
      ORDER BY community;
    `);
    console.log('✅ 社区枚举:', communities.map(c => c.community));

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
    await testShowingsTable(client);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main(); 