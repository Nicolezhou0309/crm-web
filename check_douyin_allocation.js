import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function checkDouyinAllocation() {
  console.log('🔍 检查抖音渠道分配规则...');
  
  try {
    await connectDB();

    // 1. 检查现有的分配规则
    console.log('\n📋 现有分配规则:');
    const rules = await executeQuery(`
      SELECT id, name, description, is_active, priority, conditions, user_groups, allocation_method
      FROM simple_allocation_rules
      WHERE is_active = true
      ORDER BY priority DESC, created_at ASC
    `);

    if (rules.success) {
      console.log(`✅ 找到 ${rules.data.length} 条激活的分配规则:`);
      rules.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. 规则名称: ${rule.name}`);
        console.log(`   优先级: ${rule.priority}`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   用户组: ${rule.user_groups}`);
        console.log(`   分配方法: ${rule.allocation_method}`);
        console.log(`   是否激活: ${rule.is_active}`);
      });
    }

    // 2. 检查是否有抖音专用规则
    console.log('\n🎯 检查抖音专用规则:');
    const douyinRules = await executeQuery(`
      SELECT * FROM simple_allocation_rules
      WHERE is_active = true 
        AND (name ILIKE '%抖音%' OR conditions::text ILIKE '%抖音%')
      ORDER BY priority DESC
    `);

    if (douyinRules.success && douyinRules.data.length > 0) {
      console.log(`✅ 找到 ${douyinRules.data.length} 条抖音相关规则:`);
      douyinRules.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
      });
    } else {
      console.log('❌ 未找到抖音专用分配规则');
    }

    // 3. 检查用户组配置
    console.log('\n👥 检查用户组配置:');
    const groups = await executeQuery(`
      SELECT id, groupname, list, allocation, enable_quality_control
      FROM users_list
      WHERE list IS NOT NULL AND array_length(list, 1) > 0
      ORDER BY id
    `);

    if (groups.success) {
      console.log(`✅ 找到 ${groups.data.length} 个用户组:`);
      groups.data.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.groupname} (ID: ${group.id})`);
        console.log(`   用户列表: ${group.list}`);
        console.log(`   分配方法: ${group.allocation}`);
        console.log(`   质量控制: ${group.enable_quality_control}`);
      });
    }

    // 4. 检查最近的抖音线索分配日志
    console.log('\n📊 检查最近的抖音线索分配:');
    const douyinLogs = await executeQuery(`
      SELECT 
        l.leadid,
        l.assigned_user_id,
        l.created_at,
        r.name as rule_name,
        r.priority as rule_priority,
        l.processing_details
      FROM simple_allocation_logs l
      LEFT JOIN simple_allocation_rules r ON l.rule_id = r.id
      WHERE l.processing_details::text ILIKE '%抖音%'
        AND l.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY l.created_at DESC
      LIMIT 5
    `);

    if (douyinLogs.success && douyinLogs.data.length > 0) {
      console.log(`✅ 找到 ${douyinLogs.data.length} 条抖音线索分配记录:`);
      douyinLogs.data.forEach((log, index) => {
        console.log(`\n${index + 1}. 线索ID: ${log.leadid}`);
        console.log(`   分配用户: ${log.assigned_user_id}`);
        console.log(`   使用规则: ${log.rule_name || '无'} (优先级: ${log.rule_priority || '无'})`);
        console.log(`   分配时间: ${log.created_at}`);
        console.log(`   处理详情: ${JSON.stringify(log.processing_details, null, 2)}`);
      });
    } else {
      console.log('❌ 未找到抖音线索分配记录');
    }

    // 5. 检查分配函数的条件匹配逻辑
    console.log('\n🔧 检查分配函数条件匹配:');
    const testConditions = await executeQuery(`
      SELECT 
        check_rule_conditions(
          '{"sources": ["抖音"]}'::jsonb,
          '抖音'::source,
          '意向客户',
          '北虹桥国际社区'::community
        ) as douyin_match,
        check_rule_conditions(
          '{}'::jsonb,
          '抖音'::source,
          '意向客户',
          '北虹桥国际社区'::community
        ) as empty_match
    `);

    if (testConditions.success && testConditions.data.length > 0) {
      const test = testConditions.data[0];
      console.log(`✅ 条件匹配测试:`);
      console.log(`   抖音专用条件匹配: ${test.douyin_match}`);
      console.log(`   空条件匹配: ${test.empty_match}`);
    }

    // 6. 检查是否有抖音专用用户组
    console.log('\n🎯 检查抖音专用用户组:');
    const douyinGroups = await executeQuery(`
      SELECT * FROM users_list
      WHERE groupname ILIKE '%抖音%' OR description ILIKE '%抖音%'
    `);

    if (douyinGroups.success && douyinGroups.data.length > 0) {
      console.log(`✅ 找到 ${douyinGroups.data.length} 个抖音相关用户组:`);
      douyinGroups.data.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.groupname} (ID: ${group.id})`);
        console.log(`   用户列表: ${group.list}`);
        console.log(`   描述: ${group.description}`);
      });
    } else {
      console.log('❌ 未找到抖音专用用户组');
    }

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

checkDouyinAllocation(); 