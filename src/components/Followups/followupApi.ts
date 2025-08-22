import { supabase } from '../../supaClient';

/**
 * 通用：保存/更新跟进记录的单个字段
 */
export async function saveFollowupField(id: string, updateObj: Record<string, any>) {
  const { error } = await supabase
    .from('followups')
    .update(updateObj)
    .eq('id', id);
  return error;
}

/**
 * 通用：批量保存/更新跟进记录
 */
export async function batchSaveFollowups(updateList: { id: string; updateObj: Record<string, any> }[]) {
  const results = await Promise.all(updateList.map(item =>
    supabase.from('followups').update(item.updateObj).eq('id', item.id)
  ));
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