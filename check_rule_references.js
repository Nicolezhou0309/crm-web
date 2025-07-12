import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wteqgprgiylmxzszcnws.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyOTk5NTA4MjgsImV4cCI6MjA2Nzg3NTk1MDgyOH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
);

async function checkRuleReferences() {
  try {
    console.log('检查积分成本规则引用情况...\n');
    
    // 获取所有积分成本规则
    const { data: rules, error: rulesError } = await supabase
      .from('lead_points_cost')
      .select('id, name, is_active');
    
    if (rulesError) throw rulesError;
    
    console.log('积分成本规则列表:');
    rules.forEach(rule => {
      console.log(`- ${rule.name} (ID: ${rule.id}, 状态: ${rule.is_active ? '启用' : '禁用'})`);
    });
    
    // 检查每个规则是否被分配记录引用
    for (const rule of rules) {
      const { data: references, error: refError } = await supabase
        .from('simple_allocation_logs')
        .select('id, leadid, created_at')
        .eq('cost_rule_id', rule.id);
      
      if (refError) {
        console.error(`检查规则 ${rule.name} 引用时出错:`, refError);
        continue;
      }
      
      console.log(`\n规则 "${rule.name}" 的引用情况:`);
      if (references && references.length > 0) {
        console.log(`  ❌ 被 ${references.length} 条分配记录引用，无法删除`);
        references.slice(0, 3).forEach(ref => {
          console.log(`    - 线索: ${ref.leadid}, 时间: ${ref.created_at}`);
        });
        if (references.length > 3) {
          console.log(`    ... 还有 ${references.length - 3} 条记录`);
        }
      } else {
        console.log(`  ✅ 未被引用，可以安全删除`);
      }
    }
    
    // 检查是否有分配记录引用了不存在的规则
    const { data: orphanedRefs, error: orphanError } = await supabase
      .from('simple_allocation_logs')
      .select('id, leadid, cost_rule_id, created_at')
      .not('cost_rule_id', 'is', null);
    
    if (orphanError) {
      console.error('检查孤立引用时出错:', orphanError);
    } else {
      console.log('\n检查孤立引用...');
      const validRuleIds = rules.map(r => r.id);
      const orphaned = orphanedRefs.filter(ref => !validRuleIds.includes(ref.cost_rule_id));
      
      if (orphaned.length > 0) {
        console.log(`⚠️  发现 ${orphaned.length} 条记录引用了不存在的规则ID`);
        orphaned.slice(0, 5).forEach(ref => {
          console.log(`  - 线索: ${ref.leadid}, 规则ID: ${ref.cost_rule_id}`);
        });
      } else {
        console.log('✅ 没有发现孤立引用');
      }
    }
    
  } catch (error) {
    console.error('检查规则引用失败:', error);
  }
}

checkRuleReferences(); 