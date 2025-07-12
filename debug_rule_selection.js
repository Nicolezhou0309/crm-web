import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function debugRuleSelection() {
  console.log('🔍 调试规则选择逻辑...');
  
  try {
    await connectDB();

    // 1. 检查所有激活的规则及其条件
    console.log('\n📋 所有激活的分配规则:');
    const allRules = await executeQuery(`
      SELECT 
        id, name, description, is_active, priority, 
        conditions, user_groups, allocation_method,
        created_at
      FROM simple_allocation_rules
      WHERE is_active = true
      ORDER BY priority DESC, created_at ASC
    `);

    if (allRules.success) {
      console.log(`✅ 找到 ${allRules.data.length} 条激活规则:`);
      allRules.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   用户组: ${rule.user_groups}`);
        console.log(`   创建时间: ${rule.created_at}`);
      });
    }

    // 2. 测试条件匹配函数
    console.log('\n🧪 测试条件匹配函数:');
    const testSource = '抖音';
    const testLeadtype = null;
    const testCommunity = '北虹桥国际社区';
    
    allRules.data.forEach(async (rule, index) => {
      const conditionMatch = await executeQuery(`
        SELECT check_rule_conditions($1::jsonb, $2::source, $3, $4::community) as matches
      `, [JSON.stringify(rule.conditions), testSource, testLeadtype, testCommunity]);
      
      if (conditionMatch.success && conditionMatch.data.length > 0) {
        const matches = conditionMatch.data[0].matches;
        console.log(`\n规则 ${index + 1} (${rule.name}): ${matches ? '✅ 匹配' : '❌ 不匹配'}`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   测试数据: source=${testSource}, leadtype=${testLeadtype}, community=${testCommunity}`);
      }
    });

    // 3. 检查分配函数的规则遍历逻辑
    console.log('\n🔧 检查分配函数逻辑:');
    const functionSource = await executeQuery(`
      SELECT prosrc FROM pg_proc WHERE proname = 'allocate_lead_simple'
    `);
    
    if (functionSource.success && functionSource.data.length > 0) {
      const source = functionSource.data[0].prosrc;
      console.log('✅ 找到分配函数源码');
      
      // 检查是否有规则遍历逻辑
      if (source.includes('FOR rule_record IN')) {
        console.log('✅ 函数包含规则遍历逻辑');
      } else {
        console.log('❌ 函数缺少规则遍历逻辑');
      }
      
      // 检查条件匹配调用
      if (source.includes('check_rule_conditions')) {
        console.log('✅ 函数调用条件匹配函数');
      } else {
        console.log('❌ 函数未调用条件匹配函数');
      }
    }

    // 4. 手动测试规则遍历
    console.log('\n🧪 手动测试规则遍历:');
    const manualTest = await executeQuery(`
      SELECT 
        r.id,
        r.name,
        r.priority,
        r.conditions,
        check_rule_conditions(r.conditions, '抖音'::source, NULL, '北虹桥国际社区'::community) as condition_match
      FROM simple_allocation_rules r
      WHERE r.is_active = true
      ORDER BY r.priority DESC, r.created_at ASC
    `);

    if (manualTest.success) {
      console.log('✅ 手动规则遍历测试:');
      manualTest.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件匹配: ${rule.condition_match ? '✅ 是' : '❌ 否'}`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
      });
    }

    // 5. 检查是否有规则被跳过的原因
    console.log('\n🔍 检查规则被跳过的原因:');
    const skippedRules = await executeQuery(`
      SELECT 
        r.id,
        r.name,
        r.priority,
        r.conditions,
        r.user_groups,
        CASE 
          WHEN r.conditions IS NULL OR r.conditions = '{}' THEN '空条件'
          WHEN r.conditions ? 'sources' THEN '有来源条件'
          WHEN r.conditions ? 'communities' THEN '有社区条件'
          ELSE '其他条件'
        END as condition_type
      FROM simple_allocation_rules r
      WHERE r.is_active = true
      ORDER BY r.priority DESC
    `);

    if (skippedRules.success) {
      console.log('✅ 规则条件分析:');
      skippedRules.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件类型: ${rule.condition_type}`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   用户组: ${rule.user_groups}`);
      });
    }

    // 6. 检查用户组是否有效
    console.log('\n👥 检查用户组有效性:');
    const validGroups = await executeQuery(`
      SELECT 
        ul.id,
        ul.groupname,
        ul.list,
        array_length(ul.list, 1) as user_count
      FROM users_list ul
      WHERE ul.list IS NOT NULL AND array_length(ul.list, 1) > 0
      ORDER BY ul.id
    `);

    if (validGroups.success) {
      console.log('✅ 有效用户组:');
      validGroups.data.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.groupname} (ID: ${group.id})`);
        console.log(`   用户数量: ${group.user_count}`);
        console.log(`   用户列表: ${group.list}`);
      });
    }

  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

debugRuleSelection(); 