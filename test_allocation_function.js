import { Client } from 'pg';

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

async function testAllocationFunction() {
  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 成功连接到数据库');

    // 测试1: 检查分配规则是否存在
    console.log('\n📋 测试1: 检查分配规则');
    const rulesResult = await client.query(`
      SELECT id, name, is_active, priority, user_groups 
      FROM simple_allocation_rules 
      WHERE is_active = true 
      ORDER BY priority DESC
    `);
    
    if (rulesResult.rows.length > 0) {
      console.log(`✅ 找到 ${rulesResult.rows.length} 个活跃的分配规则:`);
      rulesResult.rows.forEach((rule, index) => {
        console.log(`  ${index + 1}. ${rule.name} (优先级: ${rule.priority}, 用户组: ${rule.user_groups})`);
      });
    } else {
      console.log('⚠️  没有找到活跃的分配规则');
    }

    // 测试2: 检查用户组是否存在
    console.log('\n👥 测试2: 检查用户组');
    const groupsResult = await client.query(`
      SELECT id, groupname, list, allocation 
      FROM users_list 
      WHERE list IS NOT NULL AND array_length(list, 1) > 0
    `);
    
    if (groupsResult.rows.length > 0) {
      console.log(`✅ 找到 ${groupsResult.rows.length} 个用户组:`);
      groupsResult.rows.forEach((group, index) => {
        console.log(`  ${index + 1}. ${group.groupname} (用户数: ${group.list.length}, 分配方式: ${group.allocation})`);
      });
    } else {
      console.log('⚠️  没有找到有效的用户组');
    }

    // 测试3: 检查用户是否存在
    console.log('\n👤 测试3: 检查用户');
    const usersResult = await client.query(`
      SELECT id, email, nickname, status 
      FROM users_profile 
      WHERE status = 'active' 
      LIMIT 5
    `);
    
    if (usersResult.rows.length > 0) {
      console.log(`✅ 找到 ${usersResult.rows.length} 个活跃用户:`);
      usersResult.rows.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.nickname || user.email} (ID: ${user.id})`);
      });
    } else {
      console.log('⚠️  没有找到活跃用户');
    }

    // 测试4: 测试分配函数
    console.log('\n🎯 测试4: 测试分配函数');
    const testLeadId = 'TEST_' + Date.now();
    const testResult = await client.query(`
      SELECT allocate_lead_simple(
        $1,                    -- leadid
        '抖音'::source,        -- source
        '意向客户',            -- leadtype
        '浦江中心社区'::community, -- community
        NULL                   -- manual_user_id
      ) as result
    `, [testLeadId]);
    
    if (testResult.rows.length > 0) {
      const result = testResult.rows[0].result;
      console.log('✅ 分配函数测试结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log(`🎉 分配成功！用户ID: ${result.assigned_user_id}`);
      } else {
        console.log(`❌ 分配失败: ${result.error}`);
      }
    } else {
      console.log('❌ 分配函数测试失败');
    }

    // 测试5: 检查分配日志
    console.log('\n📊 测试5: 检查分配日志');
    const logsResult = await client.query(`
      SELECT leadid, assigned_user_id, allocation_method, created_at
      FROM simple_allocation_logs 
      WHERE leadid = $1
      ORDER BY created_at DESC
    `, [testLeadId]);
    
    if (logsResult.rows.length > 0) {
      console.log(`✅ 找到 ${logsResult.rows.length} 条分配日志:`);
      logsResult.rows.forEach((log, index) => {
        console.log(`  ${index + 1}. 线索: ${log.leadid}, 用户: ${log.assigned_user_id}, 方法: ${log.allocation_method}`);
      });
    } else {
      console.log('⚠️  没有找到分配日志');
    }

    // 测试6: 测试手动分配
    console.log('\n🎯 测试6: 测试手动分配');
    const manualTestLeadId = 'MANUAL_TEST_' + Date.now();
    const manualResult = await client.query(`
      SELECT allocate_lead_simple(
        $1,                    -- leadid
        '抖音'::source,        -- source
        '意向客户',            -- leadtype
        '浦江中心社区'::community, -- community
        1                      -- manual_user_id (手动指定用户ID)
      ) as result
    `, [manualTestLeadId]);
    
    if (manualResult.rows.length > 0) {
      const result = manualResult.rows[0].result;
      console.log('✅ 手动分配测试结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success && result.allocation_method === 'manual') {
        console.log(`🎉 手动分配成功！用户ID: ${result.assigned_user_id}`);
      } else {
        console.log(`❌ 手动分配失败: ${result.error}`);
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行测试
testAllocationFunction(); 