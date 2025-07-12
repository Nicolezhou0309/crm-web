const readline = require('readline');
const fs = require('fs');
const path = require('path');
const dbConnect = require('./db-connect');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 显示菜单
function showMenu() {
  console.log('\n🔧 Supabase数据库管理工具');
  console.log('================================');
  console.log('1. 查看所有表');
  console.log('2. 查看表结构');
  console.log('3. 查看表数据');
  console.log('4. 执行SQL查询');
  console.log('5. 执行SQL文件');
  console.log('6. 获取表行数');
  console.log('7. 查看数据库统计');
  console.log('8. 测试连接');
  console.log('0. 退出');
  console.log('================================');
}

// 获取用户输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 查看所有表
async function listAllTables() {
  console.log('\n📋 正在获取所有表...');
  const result = await dbConnect.getAllTables();
  
  if (result.success) {
    console.log(`\n✅ 找到 ${result.data.length} 个表:`);
    result.data.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });
  } else {
    console.log('❌ 获取表列表失败:', result.error);
  }
}

// 查看表结构
async function showTableStructure() {
  const tableName = await askQuestion('请输入表名: ');
  if (!tableName) return;
  
  console.log(`\n📊 正在获取表 "${tableName}" 的结构...`);
  const result = await dbConnect.getTableStructure(tableName);
  
  if (result.success) {
    console.log(`\n✅ 表 "${tableName}" 的结构:`);
    console.log('字段名\t\t数据类型\t\t可空\t\t默认值\t\t最大长度');
    console.log('------\t\t--------\t\t----\t\t------\t\t--------');
    
    result.data.forEach(column => {
      const nullable = column.is_nullable === 'YES' ? '是' : '否';
      const defaultValue = column.column_default || '无';
      const maxLength = column.character_maximum_length || 'N/A';
      
      console.log(`${column.column_name.padEnd(12)}\t${column.data_type.padEnd(12)}\t${nullable.padEnd(8)}\t${defaultValue.padEnd(12)}\t${maxLength}`);
    });
  } else {
    console.log('❌ 获取表结构失败:', result.error);
  }
}

// 查看表数据
async function showTableData() {
  const tableName = await askQuestion('请输入表名: ');
  if (!tableName) return;
  
  const limitStr = await askQuestion('请输入限制行数 (默认10): ');
  const limit = limitStr ? parseInt(limitStr) : 10;
  
  console.log(`\n📄 正在获取表 "${tableName}" 的数据 (限制 ${limit} 行)...`);
  const result = await dbConnect.viewTableData(tableName, limit);
  
  if (result.success) {
    console.log(`\n✅ 表 "${tableName}" 的数据 (共 ${result.data.length} 行):`);
    
    if (result.data.length > 0) {
      // 显示列名
      const columns = Object.keys(result.data[0]);
      console.log('\n' + columns.join('\t\t'));
      console.log('-'.repeat(columns.length * 12));
      
      // 显示数据
      result.data.forEach(row => {
        const values = columns.map(col => {
          const value = row[col];
          return value === null ? 'NULL' : String(value);
        });
        console.log(values.join('\t\t'));
      });
    } else {
      console.log('(无数据)');
    }
  } else {
    console.log('❌ 获取表数据失败:', result.error);
  }
}

// 执行SQL查询
async function executeCustomQuery() {
  console.log('\n💡 请输入SQL查询 (输入 "exit" 退出):');
  console.log('提示: 可以输入多行SQL，以分号结束');
  
  let sql = '';
  while (true) {
    const line = await askQuestion(sql ? '  ' : 'SQL> ');
    if (line.toLowerCase() === 'exit') break;
    
    sql += line + '\n';
    if (line.trim().endsWith(';')) break;
  }
  
  if (!sql.trim()) return;
  
  console.log('\n🔄 正在执行SQL查询...');
  const result = await dbConnect.executeQuery(sql);
  
  if (result.success) {
    console.log(`\n✅ 查询执行成功 (影响 ${result.rowCount} 行):`);
    if (result.data && result.data.length > 0) {
      console.log('\n结果:');
      console.log(JSON.stringify(result.data, null, 2));
    }
  } else {
    console.log('❌ 查询执行失败:', result.error);
  }
}

// 执行SQL文件
async function executeSQLFile() {
  const filePath = await askQuestion('请输入SQL文件路径: ');
  if (!filePath) return;
  
  try {
    const fullPath = path.resolve(filePath);
    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    
    console.log(`\n📁 正在执行SQL文件: ${fullPath}`);
    const result = await dbConnect.executeSQLFile(sqlContent);
    
    if (result.success) {
      console.log('✅ SQL文件执行成功');
    } else {
      console.log('❌ SQL文件执行失败:', result.error);
    }
  } catch (error) {
    console.log('❌ 读取文件失败:', error.message);
  }
}

// 获取表行数
async function getTableRowCount() {
  const tableName = await askQuestion('请输入表名: ');
  if (!tableName) return;
  
  console.log(`\n📊 正在获取表 "${tableName}" 的行数...`);
  const result = await dbConnect.getTableRowCount(tableName);
  
  if (result.success) {
    console.log(`\n✅ 表 "${tableName}" 共有 ${result.data[0].count} 行数据`);
  } else {
    console.log('❌ 获取表行数失败:', result.error);
  }
}

// 查看数据库统计
async function showDatabaseStats() {
  console.log('\n📈 正在获取数据库统计信息...');
  
  // 获取所有表
  const tablesResult = await dbConnect.getAllTables();
  if (!tablesResult.success) {
    console.log('❌ 获取表列表失败:', tablesResult.error);
    return;
  }
  
  console.log(`\n📊 数据库统计信息:`);
  console.log(`总表数: ${tablesResult.data.length}`);
  
  // 获取每个表的行数
  for (const table of tablesResult.data) {
    const countResult = await dbConnect.getTableRowCount(table.table_name);
    if (countResult.success) {
      console.log(`  ${table.table_name}: ${countResult.data[0].count} 行`);
    }
  }
}

// 测试连接
async function testConnection() {
  console.log('\n🔗 正在测试数据库连接...');
  const connected = await dbConnect.connectDB();
  
  if (connected) {
    console.log('✅ 数据库连接正常');
    await dbConnect.closeConnection();
  } else {
    console.log('❌ 数据库连接失败');
  }
}

// 主菜单循环
async function mainMenu() {
  while (true) {
    showMenu();
    const choice = await askQuestion('\n请选择操作 (0-8): ');
    
    try {
      switch (choice) {
        case '1':
          await listAllTables();
          break;
        case '2':
          await showTableStructure();
          break;
        case '3':
          await showTableData();
          break;
        case '4':
          await executeCustomQuery();
          break;
        case '5':
          await executeSQLFile();
          break;
        case '6':
          await getTableRowCount();
          break;
        case '7':
          await showDatabaseStats();
          break;
        case '8':
          await testConnection();
          break;
        case '0':
          console.log('\n👋 再见！');
          rl.close();
          return;
        default:
          console.log('\n❌ 无效选择，请重新输入');
      }
    } catch (error) {
      console.log('\n❌ 操作失败:', error.message);
    }
    
    await askQuestion('\n按回车键继续...');
  }
}

// 启动程序
async function start() {
  console.log('🚀 启动Supabase数据库管理工具...');
  
  // 测试连接
  const connected = await dbConnect.connectDB();
  if (!connected) {
    console.log('❌ 无法连接到数据库，程序退出');
    rl.close();
    return;
  }
  
  await mainMenu();
}

// 如果直接运行此文件
if (require.main === module) {
  start().catch(console.error);
} 