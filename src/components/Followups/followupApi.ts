import { supabase } from '../../supaClient';

/**
 * 通用：保存/更新跟进记录的单个字段
 */
export async function saveFollowupField(id: string, updateObj: Record<string, any>) {
  let retryCount = 0;
  const maxRetries = 3;
  
  // 记录请求参数用于调试
  console.log('🔍 [调试] saveFollowupField 请求参数:', {
    table: 'followups',
    id: id,
    updateObj: updateObj,
    updateObjKeys: Object.keys(updateObj)
  });
  
  while (retryCount < maxRetries) {
    try {
      const { error, data } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('❌ [saveFollowupField错误] 详细错误信息:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          requestParams: {
            table: 'followups',
            id: id,
            updateObj: updateObj
          }
        });
        throw error;
      }
      
      console.log('✅ [saveFollowupField成功] 更新成功:', data);
      return null; // 成功
    } catch (error: any) {
      retryCount++;
      
      console.error(`❌ [saveFollowupField重试] 第${retryCount}次尝试失败:`, {
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // 如果是超时错误且还有重试次数，等待后重试
      if (error.code === '57014' && retryCount < maxRetries) {
        console.warn(`⏰ [saveFollowupField超时] 第${retryCount}次重试...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
        continue;
      }
      
      // 其他错误或重试次数用完，返回错误
      return error;
    }
  }
  
  return null; // 理论上不会到达这里
}

/**
 * 通用：批量保存/更新跟进记录
 */
export async function batchSaveFollowups(updateList: { id: string; updateObj: Record<string, any> }[]) {
  const results = await Promise.all(updateList.map(async (item) => {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { error } = await supabase
          .from('followups')
          .update(item.updateObj)
          .eq('id', item.id);
        
        if (error) {
          throw error;
        }
        
        return { error: null }; // 成功
      } catch (error: any) {
        retryCount++;
        
        // 如果是超时错误且还有重试次数，等待后重试
        if (error.code === '57014' && retryCount < maxRetries) {
          console.warn(`批量保存数据库超时，第${retryCount}次重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
          continue;
        }
        
        // 其他错误或重试次数用完，返回错误
        return { error };
      }
    }
    
    return { error: null }; // 理论上不会到达这里
  }));
  
  return results.map(r => r.error);
}

/**
 * 字段保存函数，包含频控记录功能
 */
export async function saveFieldWithFrequency(
  frequencyController: any,
  record: any,
  field: string,
  value: any,
  originalValue: any
) {
  // 跳过未变化
  if ((originalValue ?? '') === (value ?? '')) {
    return { success: true, skipped: true };
  }
  
  // 先保存数据
  const error = await saveFollowupField(record.id, { [field]: value });
  if (error) {
    return { success: false, error: error.message };
  }
  
  // 记录操作到频控系统
  if (frequencyController && typeof frequencyController.recordOperation === 'function') {
    try {
      await frequencyController.recordOperation(record.id, originalValue, value);
    } catch (freqError) {
      console.error('[FREQ] 记录操作失败:', freqError);
      // 不影响保存结果，只记录错误
    }
  }
  
  return { success: true };
} 