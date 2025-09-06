import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { supabase } from '../supaClient';

interface CommuteTimeCalculationResult {
  success: boolean;
  communitiesCount?: number;
  commuteTimes?: Record<string, number>;
  message?: string;
  error?: string;
}

/**
 * 通勤时间计算 Hook
 * 通过 RPC 函数直接获取计算结果，不再使用 realtime 监听
 */
export const useCommuteTimeRealtime = () => {
  const [calculatingRecords, setCalculatingRecords] = useState<Set<string>>(new Set());

  /**
   * 开始计算通勤时间
   */
  const startCalculation = useCallback(async (
    followupId: string, 
    worklocation: string,
    onSuccess?: (result: CommuteTimeCalculationResult) => void,
    onError?: (error: string) => void
  ) => {
    if (!followupId || !worklocation) {
      const error = '工作地点或跟进记录ID缺失，无法计算通勤时间';
      message.warning(error);
      onError?.(error);
      return;
    }

    // 检查是否已经在计算中
    if (calculatingRecords.has(followupId)) {
      message.warning('该记录正在计算中，请稍候...');
      return;
    }

    // 添加到计算中列表
    setCalculatingRecords(prev => new Set(prev).add(followupId));

    try {
      console.log('🚀 开始计算通勤时间:', { followupId, worklocation });

      // 显示计算中的提示
      message.loading('正在计算通勤时间，请稍候...', 0);

      // 直接调用 RPC 函数并等待结果
      const { data, error } = await supabase.rpc('calculate_commute_times_for_worklocation', {
        p_followup_id: followupId,
        p_worklocation: worklocation
      });

      // 清除loading提示
      message.destroy();

      if (error) {
        console.error('❌ 通勤时间计算API调用失败:', error);
        const errorMsg = '通勤时间计算失败: ' + (error.message || '未知错误');
        message.error(errorMsg);
        onError?.(errorMsg);
        
        // 清理状态
        setCalculatingRecords(prev => {
          const newSet = new Set(prev);
          newSet.delete(followupId);
          return newSet;
        });
        return;
      }

      // 处理 RPC 返回结果
      if (data?.success) {
        console.log('✅ 通勤时间计算成功:', data);
        
        const result: CommuteTimeCalculationResult = {
          success: true,
          communitiesCount: data.communities_count,
          commuteTimes: data.commute_times,
          message: data.message
        };
        
        message.success(`通勤时间计算成功！已计算 ${data.communities_count || 0} 个社区的通勤时间`);
        
        // 调用成功回调
        onSuccess?.(result);
      } else {
        console.error('❌ 通勤时间计算失败:', data);
        const errorMsg = data?.error || '通勤时间计算失败';
        message.error(errorMsg);
        onError?.(errorMsg);
      }

      // 清理状态
      setCalculatingRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(followupId);
        return newSet;
      });

    } catch (error: any) {
      console.error('❌ 计算通勤时间异常:', error);
      message.destroy();
      const errorMsg = '计算通勤时间失败: ' + (error.message || '网络错误');
      message.error(errorMsg);
      onError?.(errorMsg);
      
      // 清理状态
      setCalculatingRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(followupId);
        return newSet;
      });
    }
  }, [calculatingRecords]);

  /**
   * 检查记录是否正在计算中
   */
  const isCalculating = useCallback((followupId: string) => {
    return calculatingRecords.has(followupId);
  }, [calculatingRecords]);

  /**
   * 清理所有计算状态
   */
  const cleanup = useCallback(() => {
    setCalculatingRecords(new Set());
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    startCalculation,
    isCalculating,
    cleanup
  };
};
