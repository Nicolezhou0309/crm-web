import { connectDB, executeQuery, closeConnection } from './db-connect.js';
import { v4 as uuidv4 } from 'uuid';

async function ensureUserGroup() {
  // 检查是否有可用用户组和用户
  const groupRes = await executeQuery(`SELECT id, list FROM users_list WHERE list IS NOT NULL AND array_length(list,1)>0 LIMIT 1`);
  if (groupRes.success && groupRes.data.length > 0) {
    return groupRes.data[0];
  }
  // 没有则自动创建
  const userRes = await executeQuery(`SELECT id FROM users_profile WHERE status='active' LIMIT 1`);
  if (!userRes.success || userRes.data.length === 0) throw new Error('无可用用户');
  const userId = userRes.data[0].id;
  const groupInsert = await executeQuery(`INSERT INTO users_list (groupname, list, allocation) VALUES ('测试分配组', ARRAY[${userId}], 'round_robin') RETURNING id, list`);
  if (groupInsert.success && groupInsert.data.length > 0) return groupInsert.data[0];
  throw new Error('无法创建用户组');
}

async function createRule({name, priority, conditions, groupId}) {
  const ruleId = uuidv4();
  const sql = `INSERT INTO simple_allocation_rules (id, name, description, is_active, priority, conditions, user_groups, allocation_method, enable_permission_check) VALUES ($1, $2, $3, true, $4, $5, ARRAY[$6], 'round_robin', false)`;
  const params = [ruleId, name, name, priority, JSON.stringify(conditions), groupId];
  const res = await executeQuery(sql, params);
  return res.success ? ruleId : null;
}

async function testPriorityFlow() {
  console.log('🚦 测试分配规则优先级流转...');
  await connectDB();
  try {
    // 1. 确保有可用用户组
    const group = await ensureUserGroup();
    const groupId = group.id;
    console.log('✅ 可用用户组ID:', groupId, '用户:', group.list);

    // 2. 创建高优先级规则（条件不命中）
    const highRuleId = await createRule({
      name: '高优先级规则-仅source测试无效',
      priority: 200,
      conditions: { sources: ['测试无效'] },
      groupId
    });
    console.log('✅ 高优先级规则ID:', highRuleId);

    // 3. 创建低优先级规则（条件宽松）
    const lowRuleId = await createRule({
      name: '低优先级规则-允许所有',
      priority: 100,
      conditions: {},
      groupId
    });
    console.log('✅ 低优先级规则ID:', lowRuleId);

    // 4. 插入测试线索（source=抖音）
    const testLeadId = 'TEST_PRIORITY_' + Date.now();
    const insertLead = await executeQuery(`
      INSERT INTO leads (leadid, phone, wechat, source, leadtype, remark, created_at)
      VALUES ($1, '13900000000', 'test_priority', '抖音', '意向客户', '优先级流转测试', NOW()) RETURNING leadid
    `, [testLeadId]);
    if (!insertLead.success) throw new Error('插入测试线索失败');
    console.log('✅ 测试线索ID:', testLeadId);

    // 5. 等待触发器分配
    await new Promise(r => setTimeout(r, 2000));

    // 6. 查询分配日志
    const logRes = await executeQuery(`
      SELECT l.leadid, l.rule_id, r.name as rule_name, r.priority, l.assigned_user_id, l.created_at, l.processing_details
      FROM simple_allocation_logs l
      LEFT JOIN simple_allocation_rules r ON l.rule_id = r.id
      WHERE l.leadid = $1
      ORDER BY l.created_at
    `, [testLeadId]);
    if (logRes.success && logRes.data.length > 0) {
      console.log('📋 分配日志:');
      logRes.data.forEach((row, idx) => {
        console.log(`\n${idx+1}. 规则: ${row.rule_name || '无'} (优先级:${row.priority || '无'})`);
        console.log(`   分配用户: ${row.assigned_user_id}`);
        console.log(`   处理详情: ${JSON.stringify(row.processing_details, null, 2)}`);
      });
    } else {
      console.log('❌ 未找到分配日志');
    }

    // 7. 检查最终分配结果
    const followupRes = await executeQuery(`SELECT * FROM followups WHERE leadid = $1`, [testLeadId]);
    if (followupRes.success && followupRes.data.length > 0) {
      const f = followupRes.data[0];
      console.log(`\n🎯 最终分配结果: 用户ID=${f.interviewsales_user_id}`);
    } else {
      console.log('❌ 未找到followups分配结果');
    }

    // 8. 清理测试规则和线索
    await executeQuery(`DELETE FROM simple_allocation_rules WHERE id IN ($1, $2)`, [highRuleId, lowRuleId]);
    await executeQuery(`DELETE FROM leads WHERE leadid = $1`, [testLeadId]);
    await executeQuery(`DELETE FROM followups WHERE leadid = $1`, [testLeadId]);
    await executeQuery(`DELETE FROM simple_allocation_logs WHERE leadid = $1`, [testLeadId]);
    console.log('\n🧹 已清理测试数据');

  } catch (e) {
    console.error('❌ 测试失败:', e);
  } finally {
    await closeConnection();
  }
}

testPriorityFlow(); 