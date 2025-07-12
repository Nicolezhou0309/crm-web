import { connectDB, executeQuery, closeConnection } from './db-connect.js';

async function checkCommunityAllocation() {
  console.log('🔍 检查社区分配逻辑...');
  
  try {
    await connectDB();

    // 1. 检查用户组与社区的对应关系
    console.log('\n👥 检查用户组配置:');
    const groups = await executeQuery(`
      SELECT 
        ul.id,
        ul.groupname,
        ul.list,
        ul.description,
        ul.enable_community_matching
      FROM users_list ul
      WHERE ul.list IS NOT NULL AND array_length(ul.list, 1) > 0
      ORDER BY ul.id
    `);

    if (groups.success) {
      console.log(`✅ 找到 ${groups.data.length} 个用户组:`);
      groups.data.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.groupname} (ID: ${group.id})`);
        console.log(`   用户列表: ${group.list}`);
        console.log(`   描述: ${group.description}`);
        console.log(`   社区匹配: ${group.enable_community_matching}`);
      });
    }

    // 2. 检查用户与社区的对应关系
    console.log('\n👤 检查用户与社区对应关系:');
    const users = await executeQuery(`
      SELECT 
        up.id,
        up.nickname,
        up.department,
        up.status
      FROM users_profile up
      WHERE up.status = 'active'
      ORDER BY up.id
    `);

    if (users.success) {
      console.log(`✅ 找到 ${users.data.length} 个活跃用户:`);
      users.data.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.nickname} (ID: ${user.id})`);
        console.log(`   部门: ${user.department}`);
        console.log(`   状态: ${user.status}`);
      });
    }

    // 3. 检查最近的分配日志，看看社区匹配情况
    console.log('\n📊 检查最近的分配日志:');
    const recentLogs = await executeQuery(`
      SELECT 
        l.leadid,
        l.assigned_user_id,
        l.created_at,
        r.name as rule_name,
        l.processing_details
      FROM simple_allocation_logs l
      LEFT JOIN simple_allocation_rules r ON l.rule_id = r.id
      WHERE l.created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY l.created_at DESC
      LIMIT 5
    `);

    if (recentLogs.success && recentLogs.data.length > 0) {
      console.log(`✅ 找到 ${recentLogs.data.length} 条最近分配记录:`);
      recentLogs.data.forEach((log, index) => {
        console.log(`\n${index + 1}. 线索ID: ${log.leadid}`);
        console.log(`   分配用户: ${log.assigned_user_id}`);
        console.log(`   使用规则: ${log.rule_name || '无'}`);
        console.log(`   处理详情: ${JSON.stringify(log.processing_details, null, 2)}`);
      });
    }

    // 4. 检查社区关键词映射表
    console.log('\n🏘️ 检查社区关键词映射:');
    const communityKeywords = await executeQuery(`
      SELECT 
        keyword,
        community,
        priority
      FROM community_keywords
      ORDER BY priority DESC
    `);

    if (communityKeywords.success) {
      console.log(`✅ 找到 ${communityKeywords.data.length} 条社区关键词映射:`);
      communityKeywords.data.forEach((mapping, index) => {
        console.log(`\n${index + 1}. 关键词: ${mapping.keyword}`);
        console.log(`   对应社区: ${mapping.community}`);
        console.log(`   优先级: ${mapping.priority}`);
      });
    } else {
      console.log('❌ 未找到社区关键词映射');
    }

    // 5. 检查社区匹配函数
    console.log('\n🔧 检查社区匹配函数:');
    const testCommunityMatch = await executeQuery(`
      SELECT 
        match_community_to_organization('浦江公园社区'::community, ARRAY[1,2,3,4,5]) as park_match,
        match_community_to_organization('浦江中心社区'::community, ARRAY[1,2,3,4,5]) as center_match
    `);

    if (testCommunityMatch.success && testCommunityMatch.data.length > 0) {
      const test = testCommunityMatch.data[0];
      console.log(`✅ 社区匹配测试:`);
      console.log(`   浦江公园社区匹配: ${JSON.stringify(test.park_match)}`);
      console.log(`   浦江中心社区匹配: ${JSON.stringify(test.center_match)}`);
    }

    // 6. 检查用户组质量控制配置
    console.log('\n⚙️ 检查用户组质量控制:');
    const qualityControl = await executeQuery(`
      SELECT 
        ul.id,
        ul.groupname,
        ul.enable_quality_control,
        ul.enable_community_matching,
        ul.daily_lead_limit,
        ul.max_pending_leads
      FROM users_list ul
      WHERE ul.list IS NOT NULL AND array_length(ul.list, 1) > 0
      ORDER BY ul.id
    `);

    if (qualityControl.success) {
      console.log(`✅ 用户组质量控制配置:`);
      qualityControl.data.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.groupname} (ID: ${group.id})`);
        console.log(`   质量控制: ${group.enable_quality_control}`);
        console.log(`   社区匹配: ${group.enable_community_matching}`);
        console.log(`   日线索限制: ${group.daily_lead_limit}`);
        console.log(`   待接收限制: ${group.max_pending_leads}`);
      });
    }

    // 7. 检查分配规则的条件
    console.log('\n📋 检查分配规则条件:');
    const ruleConditions = await executeQuery(`
      SELECT 
        name,
        priority,
        conditions,
        user_groups
      FROM simple_allocation_rules
      WHERE is_active = true
      ORDER BY priority DESC
    `);

    if (ruleConditions.success) {
      console.log(`✅ 分配规则条件:`);
      ruleConditions.data.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name} (优先级: ${rule.priority})`);
        console.log(`   条件: ${JSON.stringify(rule.conditions)}`);
        console.log(`   用户组: ${rule.user_groups}`);
      });
    }

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  } finally {
    await closeConnection();
  }
}

checkCommunityAllocation(); 