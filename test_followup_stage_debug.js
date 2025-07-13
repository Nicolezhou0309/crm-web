// 测试待接收阶段推进到确认需求的问题
import { createClient } from '@supabase/supabase-js';

// 配置Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFollowupStage() {
  console.log('🔍 开始诊断待接收阶段推进问题...\n');

  try {
    // 1. 检查followupstage枚举值
    console.log('📋 1. 检查followupstage枚举值:');
    const { data: enumData, error: enumError } = await supabase.rpc('get_enum_values', { enum_name: 'followupstage' });
    
    if (enumError) {
      console.error('❌ 获取枚举值失败:', enumError);
    } else {
      console.log('✅ 枚举值:', enumData);
      
      // 检查是否有"确认需求"
      const hasConfirmStage = enumData.includes('确认需求');
      console.log('🔍 是否包含"确认需求":', hasConfirmStage);
      
      if (!hasConfirmStage) {
        console.error('❌ 枚举中缺少"确认需求"值');
        return;
      }
    }

    // 2. 查找待接收状态的记录
    console.log('\n📋 2. 查找待接收状态的记录:');
    const { data: pendingRecords, error: pendingError } = await supabase
      .from('followups')
      .select('id, leadid, followupstage, created_at')
      .eq('followupstage', '待接收')
      .limit(5);

    if (pendingError) {
      console.error('❌ 查询待接收记录失败:', pendingError);
    } else {
      console.log('✅ 待接收记录数量:', pendingRecords?.length || 0);
      if (pendingRecords && pendingRecords.length > 0) {
        console.log('📝 示例记录:', pendingRecords[0]);
        
        // 3. 测试更新操作
        const testRecord = pendingRecords[0];
        console.log('\n📋 3. 测试更新操作:');
        console.log('🔍 测试记录ID:', testRecord.id);
        console.log('🔍 当前阶段:', testRecord.followupstage);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('followups')
          .update({ followupstage: '确认需求' })
          .eq('id', testRecord.id)
          .select();

        if (updateError) {
          console.error('❌ 更新失败:', updateError);
        } else {
          console.log('✅ 更新成功:', updateResult);
          
          // 4. 验证更新结果
          console.log('\n📋 4. 验证更新结果:');
          const { data: verifyResult, error: verifyError } = await supabase
            .from('followups')
            .select('id, followupstage')
            .eq('id', testRecord.id);

          if (verifyError) {
            console.error('❌ 验证失败:', verifyError);
          } else {
            console.log('✅ 验证结果:', verifyResult);
          }
          
          // 5. 恢复原状态（测试用）
          console.log('\n📋 5. 恢复原状态:');
          const { error: restoreError } = await supabase
            .from('followups')
            .update({ followupstage: '待接收' })
            .eq('id', testRecord.id);

          if (restoreError) {
            console.error('❌ 恢复失败:', restoreError);
          } else {
            console.log('✅ 已恢复到待接收状态');
          }
        }
      } else {
        console.log('⚠️ 没有找到待接收状态的记录');
      }
    }

    // 6. 检查用户权限
    console.log('\n📋 6. 检查当前用户权限:');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ 获取用户信息失败:', userError);
    } else {
      console.log('👤 当前用户:', user?.email || '未登录');
      
      if (user) {
        // 检查是否有管理权限
        const { data: permission, error: permError } = await supabase.rpc('has_permission', { 
          resource: 'lead', 
          action: 'manage' 
        });
        
        if (permError) {
          console.error('❌ 权限检查失败:', permError);
        } else {
          console.log('🔑 是否有lead管理权限:', permission);
        }
      }
    }

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
debugFollowupStage().then(() => {
  console.log('\n🏁 诊断完成');
}).catch(error => {
  console.error('❌ 诊断失败:', error);
}); 