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

async function testFollowupNotificationDirect() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ 已连接到数据库');

    // 1. 获取测试用户
    console.log('\n===== 获取测试用户 =====');
    const { rows: users } = await client.query(`
      SELECT id, nickname 
      FROM users_profile 
      LIMIT 2;
    `);
    
    if (users.length < 2) {
      console.log('❌ 需要至少2个用户进行测试');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    console.log('✅ 测试用户:', { user1, user2 });

    // 2. 创建测试线索
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

    // 3. 手动创建followups记录（测试新增通知）
    console.log('\n===== 测试新增followups通知 =====');
    const { rows: followupResult } = await client.query(`
      INSERT INTO followups (
        leadid, leadtype, followupstage, interviewsales_user_id, created_at, updated_at
      ) VALUES (
        $1, '长租', '待接收', $2, NOW(), NOW()
      ) RETURNING *;
    `, [testLeadId, user1.id]);
    
    console.log('✅ followups记录已创建:', followupResult[0]);

    // 4. 检查是否创建了通知
    console.log('\n===== 检查新增通知 =====');
    const { rows: notifications } = await client.query(`
      SELECT 
        id, user_id, type, title, content, status, priority, created_at,
        metadata
      FROM notifications 
      WHERE type = 'followup_assignment'
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    
    console.log('📋 新增通知:', notifications);

    // 5. 测试重新分配通知
    console.log('\n===== 测试重新分配通知 =====');
    const { rows: updateResult } = await client.query(`
      UPDATE followups 
      SET interviewsales_user_id = $1, updated_at = NOW()
      WHERE leadid = $2
      RETURNING *;
    `, [user2.id, testLeadId]);
    
    console.log('✅ followups记录已更新:', updateResult[0]);

    // 6. 检查重新分配通知
    console.log('\n===== 检查重新分配通知 =====');
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

    // 7. 测试通知内容详情
    console.log('\n===== 测试通知内容详情 =====');
    if (notifications.length > 0) {
      const notification = notifications[0];
      console.log('📋 通知详情:');
      console.log('  - ID:', notification.id);
      console.log('  - 用户ID:', notification.user_id);
      console.log('  - 类型:', notification.type);
      console.log('  - 标题:', notification.title);
      console.log('  - 内容:', notification.content);
      console.log('  - 状态:', notification.status);
      console.log('  - 优先级:', notification.priority);
      console.log('  - 元数据:', notification.metadata);
    }

    // 8. 测试通知统计
    console.log('\n===== 测试通知统计 =====');
    const { rows: stats } = await client.query(`
      SELECT 
        type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
        COUNT(*) FILTER (WHERE status = 'read') as read_count
      FROM notifications 
      WHERE type IN ('followup_assignment', 'followup_reassignment')
      GROUP BY type;
    `);
    
    console.log('📊 通知统计:', stats);

    // 9. 测试标记通知为已读
    console.log('\n===== 测试标记通知为已读 =====');
    if (notifications.length > 0) {
      const notificationId = notifications[0].id;
      const { rows: markResult } = await client.query(`
        UPDATE notifications 
        SET status = 'read', read_at = NOW()
        WHERE id = $1
        RETURNING id, status, read_at;
      `, [notificationId]);
      
      console.log('✅ 通知已标记为已读:', markResult[0]);
    }

    // 10. 清理测试数据
    console.log('\n===== 清理测试数据 =====');
    await client.query(`DELETE FROM notifications WHERE metadata->>'leadid' = $1;`, [testLeadId]);
    await client.query(`DELETE FROM followups WHERE leadid = $1;`, [testLeadId]);
    await client.query(`DELETE FROM leads WHERE leadid = $1;`, [testLeadId]);
    
    console.log('✅ 测试数据已清理');

    // 11. 性能测试
    console.log('\n===== 性能测试 =====');
    const startTime = Date.now();
    
    // 创建多个测试followups记录
    for (let i = 0; i < 5; i++) {
      const testLeadId = `25J${Date.now().toString().slice(-5)}${i}`;
      
      // 创建线索
      await client.query(`
        INSERT INTO leads (
          leadid, phone, wechat, source, leadtype, leadstatus
        ) VALUES (
          $1, '1380013800' || $2, 'test_wechat_' || $2, '抖音', '长租', '新建'
        );
      `, [testLeadId, i]);
      
      // 创建followups记录
      await client.query(`
        INSERT INTO followups (
          leadid, leadtype, followupstage, interviewsales_user_id, created_at, updated_at
        ) VALUES (
          $1, '长租', '待接收', $2, NOW(), NOW()
        );
      `, [testLeadId, user1.id]);
      
      // 添加延迟避免时间戳冲突
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const endTime = Date.now();
    console.log(`✅ 创建5个followups记录耗时: ${endTime - startTime}ms`);

    // 检查性能测试的通知
    const { rows: performanceNotifications } = await client.query(`
      SELECT COUNT(*) as notification_count
      FROM notifications 
      WHERE type = 'followup_assignment' 
      AND created_at > NOW() - INTERVAL '1 minute';
    `);
    
    console.log('📊 性能测试通知数量:', performanceNotifications[0]);

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

    console.log('\n🎉 直接测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await client.end();
  }
}

// 运行测试
testFollowupNotificationDirect(); 