import { connectDB, executeSQLFile, closeConnection, executeQuery } from './db-connect.js';
import { readFileSync } from 'fs';

// 读取SQL文件内容
function readSQLFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('❌ 读取SQL文件失败:', error.message);
    return null;
  }
}

// 部署积分系统
async function deployPointsSystem() {
  console.log('🚀 开始部署积分系统...');
  
  // 连接数据库
  const connected = await connectDB();
  if (!connected) {
    console.error('❌ 无法连接到数据库，部署失败');
    return;
  }
  
  try {
    // 读取SQL文件
    const sqlContent = readSQLFile('./deploy_points_system_unified.sql');
    if (!sqlContent) {
      console.error('❌ 无法读取SQL文件');
      return;
    }
    
    console.log('📄 正在执行积分系统部署脚本...');
    
    // 执行SQL
    const result = await executeSQLFile(sqlContent);
    
    if (result.success) {
      console.log('✅ 积分系统部署成功！');
      console.log('\n📋 部署内容包括：');
      console.log('- 积分钱包表 (user_points_wallet)');
      console.log('- 积分流水表 (user_points_transactions)');
      console.log('- 积分规则表 (points_rules)');
      console.log('- 积分兑换记录表 (points_exchange_records)');
      console.log('- 自动触发器 (update_user_points_wallet)');
      console.log('- 积分发放函数 (award_points)');
      console.log('- 积分兑换函数 (exchange_points)');
      console.log('- 用户积分信息查询函数 (get_user_points_info)');
      console.log('\n🎯 初始积分规则：');
      console.log('- 完成跟进表: +50积分');
      console.log('- 成交订单: +100积分');
      console.log('- 每日签到: +5积分');
      console.log('- 参与直播: +20积分');
      console.log('- 答题活动: +10积分');
      console.log('- 兑换线索: -30积分');
      console.log('- 违规扣分: -20积分');
    } else {
      console.error('❌ 积分系统部署失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 部署过程中发生错误:', error.message);
  } finally {
    // 关闭数据库连接
    await closeConnection();
  }
}

// 验证部署结果
async function verifyDeployment() {
  console.log('\n🔍 验证部署结果...');
  
  const connected = await connectDB();
  if (!connected) {
    console.error('❌ 无法连接到数据库进行验证');
    return;
  }
  
  try {
    // 检查表是否存在
    const tables = ['user_points_wallet', 'user_points_transactions', 'points_rules', 'points_exchange_records'];
    
    for (const table of tables) {
      const result = await executeQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.success && result.data[0].exists) {
        console.log(`✅ 表 ${table} 创建成功`);
      } else {
        console.log(`❌ 表 ${table} 创建失败`);
      }
    }
    
    // 检查函数是否存在
    const functions = ['award_points', 'exchange_points', 'get_user_points_info', 'update_user_points_wallet'];
    
    for (const func of functions) {
      const result = await executeQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = $1
        );
      `, [func]);
      
      if (result.success && result.data[0].exists) {
        console.log(`✅ 函数 ${func} 创建成功`);
      } else {
        console.log(`❌ 函数 ${func} 创建失败`);
      }
    }
    
    // 检查初始规则
    const rulesResult = await executeQuery(`
      SELECT rule_name, source_type, points_value 
      FROM points_rules 
      ORDER BY id;
    `);
    
    if (rulesResult.success) {
      console.log('\n📋 初始积分规则：');
      rulesResult.data.forEach(rule => {
        console.log(`  - ${rule.rule_name}: ${rule.points_value > 0 ? '+' : ''}${rule.points_value}积分 (${rule.source_type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message);
  } finally {
    await closeConnection();
  }
}

// 执行部署
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await deployPointsSystem();
    await verifyDeployment();
    console.log('\n🎉 积分系统部署完成！');
  })();
} 