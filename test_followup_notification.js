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

async function testFollowupNotification() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ 已连接到数据库');

    // 1. 检查触发器是否存在
    console.log('\n===== 检查触发器 =====');
    const { rows: triggers } = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers 
      WHERE trigger_name LIKE '%followup%'
      ORDER BY trigger_name;
    `);
    
    console.log('📋 触发器列表:', triggers);

    // 2. 检查函数是否存在
    console.log('\n===== 检查函数 =====');
    const { rows: functions } = await client.query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name LIKE '%followup%' OR routine_name LIKE '%notification%'
      ORDER BY routine_name;
    `);
    
    console.log('📋 函数列表:', functions);

    // 3. 获取一个测试用户ID
    console.log('\n===== 获取测试用户 =====');
    const { rows: users } = await client.query(`
      SELECT id, nickname 
      FROM users_profile 
      LIMIT 1;
    `);
    
    if (users.length === 0) {
      console.log('❌ 没有找到用户，无法进行测试');
      return;
    }
    
    const testUser = users[0];
    console.log('✅ 测试用户:', testUser);

    // 4. 创建测试线索
    console.log('\n===== 创建测试线索 =====');
    const testLeadId = `25J${Date.now().toString().slice(-5)}`;
    const { rows: leadResult } = await client.query(`
      INSERT INTO leads (
        leadid, phone, wechat, source, leadtype, leadstatus
      ) VALUES (
        $1, '13800138000', 'test_wechat', '抖音', '长租', '新建'
      ) RETURNING leadid;
    `, [testLeadId]);
    
    console.log('✅ 测试线索已创建:', leadResult[0]);

    // 5. 检查是否自动创建了followups记录
    console.log('\n===== 检查followups记录 =====');
    const { rows: followups } = await client.query(`
      SELECT * FROM followups WHERE leadid = $1;
    `, [testLeadId]);
    
    console.log('📋 followups记录:', followups);

    // 6. 检查是否创建了通知
    console.log('\n===== 检查通知 =====');
    const { rows: notifications } = await client.query(`
      SELECT 
        id, user_id, type, title, content, status, priority, created_at,
        metadata
      FROM notifications 
      WHERE type IN ('followup_assignment', 'followup_reassignment')
      ORDER BY created_at DESC 
      LIMIT 5;
    `);
    
    console.log('📋 最近的通知:', notifications);

    // 7. 测试重新分配功能
    console.log('\n===== 测试重新分配 =====');
    if (followups.length > 0) {
      const followupId = followups[0].id;
      const newUserId = testUser.id;
      
      const { rows: updateResult } = await client.query(`
        UPDATE followups 
        SET interviewsales_user_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `, [newUserId, followupId]);
      
      console.log('✅ 重新分配结果:', updateResult);
      
      // 检查是否创建了重新分配通知
      const { rows: reassignmentNotifications } = await client.query(`
        SELECT 
          id, user_id, type, title, content, status, priority, created_at,
          metadata
        FROM notifications 
        WHERE type = 'followup_reassignment'
        ORDER BY created_at DESC 
        LIMIT 3;
      `);
      
      console.log('📋 重新分配通知:', reassignmentNotifications);
    }

    // 8. 清理测试数据
    console.log('\n===== 清理测试数据 =====');
    await client.query(`DELETE FROM notifications WHERE metadata->>'leadid' = $1;`, [testLeadId]);
    await client.query(`DELETE FROM followups WHERE leadid = $1;`, [testLeadId]);
    await client.query(`DELETE FROM leads WHERE leadid = $1;`, [testLeadId]);
    
    console.log('✅ 测试数据已清理');

    // 9. 性能测试
    console.log('\n===== 性能测试 =====');
    const startTime = Date.now();
    
    // 创建多个测试线索
    for (let i = 0; i < 5; i++) {
      const testLeadId = `25J${Date.now().toString().slice(-5)}${i}`;
      await client.query(`
        INSERT INTO leads (
          leadid, phone, wechat, source, leadtype, leadstatus
        ) VALUES (
          $1, '1380013800' || $2, 'test_wechat_' || $2, '抖音', '长租', '新建'
        );
      `, [testLeadId, i]);
    }
    
    const endTime = Date.now();
    console.log(`✅ 创建5个线索耗时: ${endTime - startTime}ms`);

    // 清理性能测试数据
    await client.query(`
      DELETE FROM notifications 
      WHERE created_at > NOW() - INTERVAL '5 minutes' 
      AND type IN ('followup_assignment', 'followup_reassignment');
    `);
    
    await client.query(`
      DELETE FROM followups 
      WHERE created_at > NOW() - INTERVAL '5 minutes';
    `);
    
    await client.query(`
      DELETE FROM leads 
      WHERE created_at > NOW() - INTERVAL '5 minutes';
    `);

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await client.end();
  }
}

// 运行测试
testFollowupNotification(); 