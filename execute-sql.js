import { executeSQLFile, connectDB, closeConnection } from './db-connect.js';
import fs from 'fs';

async function executeSQL() {
  try {
    console.log('🔗 连接数据库...');
    const connected = await connectDB();
    
    if (!connected) {
      console.log('❌ 数据库连接失败');
      return;
    }
    
    console.log('📁 读取SQL文件...');
    const sql = fs.readFileSync('./create_points_tables.sql', 'utf8');
    
    console.log('🔄 执行SQL...');
    const result = await executeSQLFile(sql);
    
    if (result.success) {
      console.log('✅ SQL执行成功！');
      console.log('📊 积分系统表结构已创建完成');
    } else {
      console.log('❌ SQL执行失败:', result.error);
    }
    
    await closeConnection();
  } catch (error) {
    console.error('❌ 执行失败:', error);
  }
}

executeSQL(); 