import { useCallback, useState } from 'react';
import { message } from 'antd';
import { supabase } from '../../../supaClient';

interface AutoSaveConfig {
  maxRetries?: number;
  retryDelay?: number;
}

interface AutoSaveResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export const useAutoSave = (config: AutoSaveConfig = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000
  } = config;

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  
  // 更新统计
  const [stats, setStats] = useState({
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    skippedUpdates: 0
  });

  // 立即保存单个字段
  const saveField = useCallback(async (
    id: string, 
    field: string, 
    value: any, 
    originalValue: any
  ): Promise<AutoSaveResult> => {
    
    // 跳过未变化的值
    if ((originalValue ?? '') === (value ?? '')) {
      setStats(prev => ({
        ...prev,
        skippedUpdates: prev.skippedUpdates + 1
      }));
      return { success: true, skipped: true };
    }

    setIsSaving(true);
    
    try {
      // 直接保存到数据库
      const { error } = await supabase
        .from('followups')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) {
        console.error('Supabase 更新失败:', error);
        setStats(prev => ({
          ...prev,
          failedUpdates: prev.failedUpdates + 1
        }));
        return { success: false, error: error.message };
      }
      setStats(prev => ({
        ...prev,
        totalUpdates: prev.totalUpdates + 1,
        successfulUpdates: prev.successfulUpdates + 1
      }));
      
      return { success: true };
    } catch (error) {
      console.error('保存过程中发生异常:', error);
      setStats(prev => ({
        ...prev,
        failedUpdates: prev.failedUpdates + 1
      }));
      return { success: false, error: (error as Error).message };
    } finally {
      setIsSaving(false);
    }
  }, []);

  // 带重试的保存
  const saveFieldWithRetry = useCallback(async (
    id: string, 
    field: string, 
    value: any, 
    originalValue: any,
    retryCount = 0
  ): Promise<AutoSaveResult> => {
    const result = await saveField(id, field, value, originalValue);
    
    // 如果保存失败且未超过重试次数，则重试
    if (!result.success && retryCount < maxRetries) {
      // 延迟重试
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return saveFieldWithRetry(id, field, value, originalValue, retryCount + 1);
    }
    
    return result;
  }, [saveField, maxRetries, retryDelay]);

  // 清理统计
  const resetStats = useCallback(() => {
    setStats({
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedUpdates: 0
    });
  }, []);

  return {
    // 状态
    isSaving,
    stats,
    
    // 方法
    saveField,
    saveFieldWithRetry,
    resetStats
  };
};
