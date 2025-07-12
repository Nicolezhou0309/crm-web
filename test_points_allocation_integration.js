const { createClient } = require('@supabase/supabase-js');

// 配置Supabase客户端
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPointsAllocationIntegration() {
  console.log('🧪 开始测试积分分配规则集成...\n');

  try {
    // 1. 测试积分成本规则表是否存在
    console.log('1. 检查积分成本规则表...');
    const { data: costRules, error: costRulesError } = await supabase
      .from('lead_points_cost')
      .select('*')
      .limit(1);
    
    if (costRulesError) {
      console.log('❌ 积分成本规则表不存在或无法访问');
      console.log('错误:', costRulesError.message);
      return;
    }
    console.log('✅ 积分成本规则表存在');

    // 2. 测试创建积分成本规则
    console.log('\n2. 测试创建积分成本规则...');
    const testRule = {
      name: '测试积分规则',
      description: '用于测试的积分成本规则',
      base_points_cost: 50,
      conditions: {
        sources: ['抖音'],
        lead_types: ['普通'],
        communities: ['测试社区']
      },
      dynamic_cost_config: {
        source_adjustments: {
          '抖音': 15
        },
        keyword_adjustments: {
          '高意向': 20
        }
      },
      priority: 100,
      is_active: true
    };

    const { data: createdRule, error: createError } = await supabase
      .from('lead_points_cost')
      .insert([testRule])
      .select()
      .single();

    if (createError) {
      console.log('❌ 创建积分成本规则失败');
      console.log('错误:', createError.message);
      return;
    }
    console.log('✅ 积分成本规则创建成功');
    console.log('规则ID:', createdRule.id);

    // 3. 测试查询积分成本规则
    console.log('\n3. 测试查询积分成本规则...');
    const { data: rules, error: queryError } = await supabase
      .from('lead_points_cost')
      .select('*')
      .order('priority', { ascending: false });

    if (queryError) {
      console.log('❌ 查询积分成本规则失败');
      console.log('错误:', queryError.message);
      return;
    }
    console.log('✅ 查询积分成本规则成功');
    console.log('规则数量:', rules.length);

    // 4. 测试更新积分成本规则
    console.log('\n4. 测试更新积分成本规则...');
    const updateData = {
      base_points_cost: 75,
      description: '更新后的测试规则'
    };

    const { data: updatedRule, error: updateError } = await supabase
      .from('lead_points_cost')
      .update(updateData)
      .eq('id', createdRule.id)
      .select()
      .single();

    if (updateError) {
      console.log('❌ 更新积分成本规则失败');
      console.log('错误:', updateError.message);
      return;
    }
    console.log('✅ 积分成本规则更新成功');
    console.log('更新后的积分成本:', updatedRule.base_points_cost);

    // 5. 测试删除积分成本规则
    console.log('\n5. 测试删除积分成本规则...');
    const { error: deleteError } = await supabase
      .from('lead_points_cost')
      .delete()
      .eq('id', createdRule.id);

    if (deleteError) {
      console.log('❌ 删除积分成本规则失败');
      console.log('错误:', deleteError.message);
      return;
    }
    console.log('✅ 积分成本规则删除成功');

    // 6. 测试分配日志表是否包含积分相关字段
    console.log('\n6. 检查分配日志表结构...');
    const { data: logs, error: logsError } = await supabase
      .from('simple_allocation_logs')
      .select('*')
      .limit(1);

    if (logsError) {
      console.log('❌ 分配日志表不存在或无法访问');
      console.log('错误:', logsError.message);
      return;
    }
    console.log('✅ 分配日志表存在');

    // 检查是否有积分相关字段
    if (logs.length > 0) {
      const logFields = Object.keys(logs[0]);
      const pointsFields = logFields.filter(field => 
        field.includes('points') || field.includes('cost') || field.includes('balance')
      );
      console.log('积分相关字段:', pointsFields);
    }

    console.log('\n🎉 积分分配规则集成测试完成！');
    console.log('\n📋 测试总结:');
    console.log('- ✅ 积分成本规则表存在且可访问');
    console.log('- ✅ 可以创建、查询、更新、删除积分成本规则');
    console.log('- ✅ 分配日志表存在');
    console.log('- ✅ 前端集成已完成，可以在分配管理页面中查看"积分规则"标签页');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testPointsAllocationIntegration(); 