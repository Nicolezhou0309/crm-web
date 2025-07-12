import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function checkFollowupsIssue() {
  console.log('🔍 检查分配日志和followups记录...');
  
  try {
    // 连接数据库
    const connected = await connectDB();
    if (!connected) {
      console.log('❌ 数据库连接失败');
      return;
    }

    // 1. 检查最近的分配日志
    console.log('\n📊 检查最近的分配日志...');
    const allocationLogs = await executeQuery(`
      SELECT 
        l.leadid,
        l.assigned_user_id,
        l.created_at,
        l.processing_details,
        CASE WHEN f.leadid IS NULL THEN '未创建followups' ELSE '已创建followups' END as followups_status
      FROM simple_allocation_logs l
      LEFT JOIN followups f ON l.leadid = f.leadid
      WHERE l.created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY l.created_at DESC
      LIMIT 10
    `);

    if (allocationLogs.success) {
      console.log(`✅ 找到 ${allocationLogs.data.length} 条最近的分配记录:`);
      allocationLogs.data.forEach((log, index) => {
        console.log(`\n${index + 1}. 线索ID: ${log.leadid}`);
        console.log(`   分配用户ID: ${log.assigned_user_id}`);
        console.log(`   创建时间: ${log.created_at}`);
        console.log(`   Followups状态: ${log.followups_status}`);
        if (log.processing_details) {
          console.log(`   处理详情: ${JSON.stringify(log.processing_details, null, 2)}`);
        }
      });
    } else {
      console.log('❌ 查询分配日志失败:', allocationLogs.error);
    }

    // 2. 检查分配成功但未创建followups的记录
    console.log('\n🔍 检查分配成功但未创建followups的记录...');
    const missingFollowups = await executeQuery(`
      SELECT 
        l.leadid,
        l.assigned_user_id,
        l.created_at,
        leads.leadtype
      FROM simple_allocation_logs l
      JOIN leads ON l.leadid = leads.leadid
      LEFT JOIN followups f ON l.leadid = f.leadid
      WHERE l.assigned_user_id IS NOT NULL
        AND f.leadid IS NULL
        AND l.created_at >= NOW() - INTERVAL '24 hours'
        AND (l.processing_details->>'allocation_success')::boolean = true
      ORDER BY l.created_at DESC
    `);

    if (missingFollowups.success) {
      console.log(`✅ 找到 ${missingFollowups.data.length} 条分配成功但未创建followups的记录:`);
      missingFollowups.data.forEach((record, index) => {
        console.log(`\n${index + 1}. 线索ID: ${record.leadid}`);
        console.log(`   线索类型: ${record.leadtype}`);
        console.log(`   分配用户ID: ${record.assigned_user_id}`);
        console.log(`   分配时间: ${record.created_at}`);
      });
    } else {
      console.log('❌ 查询缺失followups记录失败:', missingFollowups.error);
    }

    // 3. 检查触发器函数是否存在
    console.log('\n🔧 检查触发器函数...');
    const triggerFunction = await executeQuery(`
      SELECT 
        proname as function_name,
        prosrc as function_source
      FROM pg_proc 
      WHERE proname = 'simple_lead_allocation_trigger'
    `);

    if (triggerFunction.success && triggerFunction.data.length > 0) {
      console.log('✅ 触发器函数存在');
    } else {
      console.log('❌ 触发器函数不存在');
    }

    // 4. 检查触发器是否存在
    console.log('\n🔧 检查触发器...');
    const trigger = await executeQuery(`
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_table
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_simple_lead_allocation'
    `);

    if (trigger.success && trigger.data.length > 0) {
      console.log('✅ 触发器存在');
      trigger.data.forEach(t => {
        console.log(`   触发器名: ${t.trigger_name}`);
        console.log(`   事件: ${t.event_manipulation}`);
        console.log(`   表: ${t.event_object_table}`);
      });
    } else {
      console.log('❌ 触发器不存在');
    }

    // 5. 统计信息
    console.log('\n📈 统计信息...');
    const stats = await executeQuery(`
      SELECT 
        '分配统计' as info,
        COUNT(*) as total_allocated,
        COUNT(CASE WHEN f.leadid IS NOT NULL THEN 1 END) as with_followups,
        COUNT(CASE WHEN f.leadid IS NULL THEN 1 END) as without_followups
      FROM simple_allocation_logs l
      LEFT JOIN followups f ON l.leadid = f.leadid
      WHERE l.created_at >= NOW() - INTERVAL '24 hours'
        AND l.assigned_user_id IS NOT NULL
    `);

    if (stats.success && stats.data.length > 0) {
      const stat = stats.data[0];
      console.log(`✅ 24小时内分配统计:`);
      console.log(`   总分配数: ${stat.total_allocated}`);
      console.log(`   有followups记录: ${stat.with_followups}`);
      console.log(`   无followups记录: ${stat.without_followups}`);
      console.log(`   成功率: ${stat.total_allocated > 0 ? ((stat.with_followups / stat.total_allocated) * 100).toFixed(2) : 0}%`);
    }

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

// 执行检查
checkFollowupsIssue(); 