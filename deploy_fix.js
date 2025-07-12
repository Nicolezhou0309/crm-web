import { Client } from 'pg';
import fs from 'fs';

// 数据库连接配置
const dbConfig = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.wteqgprgiylmxzszcnws',
  password: 'gAC5Yqi01wh3eISR',
  ssl: {
    rejectUnauthorized: false
  }
};

// 创建数据库客户端
const client = new Client(dbConfig);

async function deployFix() {
  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 成功连接到数据库');

    // 读取修复SQL文件
    const sqlContent = fs.readFileSync('fix_allocate_lead_simple.sql', 'utf8');
    console.log('📄 读取修复SQL文件成功');

    // 执行SQL
    console.log('🔄 正在部署修复...');
    await client.query(sqlContent);
    console.log('✅ 修复部署成功！');

    // 验证函数是否存在
    const result = await client.query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name = 'allocate_lead_simple' 
      AND routine_schema = 'public'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ 函数验证成功：allocate_lead_simple 已存在');
    } else {
      console.log('❌ 函数验证失败：allocate_lead_simple 不存在');
    }

  } catch (error) {
    console.error('❌ 部署失败:', error.message);
  } finally {
    await client.end();
    console.log('🔌 数据库连接已关闭');
  }
}

// 执行部署
deployFix(); 