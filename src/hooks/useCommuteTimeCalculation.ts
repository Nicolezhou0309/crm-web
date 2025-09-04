/**
 * 通勤时间计算Hook - 轮询版本
 * 用于替代useCommuteTimeRealtime，避免WebSocket混合内容问题
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { message } from 'antd';

interface CommuteTimeCalculationResult {
  followupId: string;
  commuteTimes: any;
  worklocation: string;
}

export const useCommuteTimeCalculation = () => {
  const [calculatingRecords, setCalculatingRecords] = useState<Set<string>>(new Set());
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const startCalculation = useCallback(async (
    followupId: string, 
    worklocation: string,
    onSuccess?: (result: CommuteTimeCalculationResult) => void,
    onError?: (error: string) => void
  ) => {
    
    // 检查是否已在计算中
    if (calculatingRecords.has(followupId)) {
      console.log('⚠️ [CommuteTime] 该记录已在计算中:', followupId);
      return;
    }

    // 添加到计算中列表
    setCalculatingRecords(prev => new Set(prev).add(followupId));

    try {
      console.log('🚀 开始计算通勤时间:', { followupId, worklocation });

      // 显示计算中的提示
      message.loading('正在计算通勤时间，请稍候...', 0);

      // 调用计算函数
      const { error: calculationError } = await supabase.rpc('calculate_commute_time', {
        followup_id: followupId,
        work_location: worklocation
      });

      if (calculationError) {
        console.error('❌ [CommuteTime] 计算函数调用失败:', calculationError);
        message.destroy();
        message.error('通勤时间计算失败');
        
        setCalculatingRecords(prev => {
          const newSet = new Set(prev);
          newSet.delete(followupId);
          return newSet;
        });

        if (onError) {
          onError(calculationError.message);
        }
        return;
      }

      console.log('📤 [CommuteTime] 通勤时间计算指令已发送，开始轮询结果...');

      // 轮询检查计算结果
      const pollForResult = async (): Promise<boolean> => {
        try {
          const { data: followup, error } = await supabase
            .from('followups')
            .select('id, extended_data, worklocation')
            .eq('id', followupId)
            .single();

          if (error) {
            console.error('❌ [CommuteTime] 查询跟进记录失败:', error);
            return false;
          }

          if (followup?.extended_data?.commute_times) {
            console.log('✅ [CommuteTime] 通勤时间计算完成:', followup.extended_data.commute_times);
            
            // 停止监听
            message.destroy();
            message.success('通勤时间计算完成');
            
            // 从计算中列表移除
            setCalculatingRecords(prev => {
              const newSet = new Set(prev);
              newSet.delete(followupId);
              return newSet;
            });
            
            // 调用成功回调
            if (onSuccess) {
              onSuccess({
                followupId,
                commuteTimes: followup.extended_data.commute_times,
                worklocation: followup.worklocation
              });
            }
            
            return true; // 计算完成
          }
          
          return false; // 继续轮询
        } catch (error) {
          console.error('❌ [CommuteTime] 轮询检查失败:', error);
          return false;
        }
      };

      // 立即检查一次
      const isComplete = await pollForResult();
      if (isComplete) return;

      // 设置轮询定时器
      const pollInterval = setInterval(async () => {
        const isComplete = await pollForResult();
        if (isComplete) {
          clearInterval(pollInterval);
          pollingIntervals.current.delete(followupId);
        }
      }, 2000); // 每2秒检查一次

      // 存储定时器引用以便清理
      pollingIntervals.current.set(followupId, pollInterval);

      // 设置超时保护（60秒后自动取消监听）
      setTimeout(() => {
        if (calculatingRecords.has(followupId)) {
          console.log('⏰ [CommuteTime] 通勤时间计算超时，取消监听');
          message.destroy();
          message.warning('计算时间较长，请稍后刷新页面查看结果');
          
          setCalculatingRecords(prev => {
            const newSet = new Set(prev);
            newSet.delete(followupId);
            return newSet;
          });

          // 清理轮询定时器
          const interval = pollingIntervals.current.get(followupId);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(followupId);
          }

          if (onError) {
            onError('计算超时');
          }
        }
      }, 60000); // 60秒超时

    } catch (error) {
      console.error('❌ [CommuteTime] 计算过程异常:', error);
      message.destroy();
      message.error('通勤时间计算失败');
      
      setCalculatingRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(followupId);
        return newSet;
      });

      if (onError) {
        onError(error instanceof Error ? error.message : '未知错误');
      }
    }
  }, [calculatingRecords]);

  // 取消计算
  const cancelCalculation = useCallback((followupId: string) => {
    if (calculatingRecords.has(followupId)) {
      console.log('🛑 [CommuteTime] 取消通勤时间计算:', followupId);
      
      setCalculatingRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(followupId);
        return newSet;
      });

      // 清理轮询定时器
      const interval = pollingIntervals.current.get(followupId);
      if (interval) {
        clearInterval(interval);
        pollingIntervals.current.delete(followupId);
      }

      message.destroy();
      message.info('已取消通勤时间计算');
    }
  }, [calculatingRecords]);

  // 清理所有轮询定时器
  const cleanup = useCallback(() => {
    pollingIntervals.current.forEach((interval, followupId) => {
      clearInterval(interval);
    });
    pollingIntervals.current.clear();
  }, []);

  return {
    calculatingRecords,
    startCalculation,
    cancelCalculation,
    cleanup
  };
};
