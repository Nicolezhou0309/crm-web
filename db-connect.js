import { Client } from 'pg';

// 数据库连接配置 - Session Pooler
const dbConfig = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.wteqgprgiylmxzszcnws',
  password: 'gAC5Yqi01wh3eISR',
  ssl: {
    rejectUnauthorized: false
  },
  // Session pooler 配置
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
};

// 创建数据库客户端
const client = new Client(dbConfig);

// 连接数据库
async function connectDB() {
  try {
    await client.connect();
    console.log('✅ 成功连接到Supabase数据库');
    return true;
  } catch (error) {
    console.error('❌ 连接数据库失败:', error.message);
    return false;
  }
}

// 执行查询
async function executeQuery(query, params = []) {
  try {
    const result = await client.query(query, params);
    return { success: true, data: result.rows, rowCount: result.rowCount };
  } catch (error) {
    console.error('❌ 查询执行失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 获取表结构
async function getTableStructure(tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = $1 
    ORDER BY ordinal_position;
  `;
  
  return await executeQuery(query, [tableName]);
}

// 获取所有表名
async function getAllTables() {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  
  return await executeQuery(query);
}

// 获取表的行数
async function getTableRowCount(tableName) {
  const query = `SELECT COUNT(*) as count FROM ${tableName}`;
  return await executeQuery(query);
}

// 查看表数据（限制行数）
async function viewTableData(tableName, limit = 10) {
  const query = `SELECT * FROM ${tableName} LIMIT $1`;
  return await executeQuery(query, [limit]);
}

// 执行SQL文件
async function executeSQLFile(sqlContent) {
  try {
    const result = await client.query(sqlContent);
    console.log('✅ SQL执行成功');
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ SQL执行失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 关闭连接
async function closeConnection() {
  try {
    await client.end();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭连接失败:', error.message);
  }
}

// 导出函数供其他模块使用
export {
  connectDB,
  executeQuery,
  getTableStructure,
  getAllTables,
  getTableRowCount,
  viewTableData,
  executeSQLFile,
  closeConnection,
  client
};

// 如果直接运行此文件，执行测试连接
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('🔗 正在连接Supabase数据库...');
    const connected = await connectDB();
    
    if (connected) {
      console.log('\n📊 数据库连接测试成功！');
      console.log('可用功能:');
      console.log('- executeQuery(query, params) - 执行SQL查询');
      console.log('- getTableStructure(tableName) - 获取表结构');
      console.log('- getAllTables() - 获取所有表名');
      console.log('- getTableRowCount(tableName) - 获取表行数');
      console.log('- viewTableData(tableName, limit) - 查看表数据');
      console.log('- executeSQLFile(sqlContent) - 执行SQL文件');
      console.log('- closeConnection() - 关闭连接');
      
      // 测试获取所有表
      const tables = await getAllTables();
      if (tables.success) {
        console.log('\n📋 数据库中的表:');
        tables.data.forEach(table => {
          console.log(`  - ${table.table_name}`);
        });
      }
      
      await closeConnection();
    }
  })();
} 