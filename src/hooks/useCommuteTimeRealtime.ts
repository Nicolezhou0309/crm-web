import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import { supabase } from '../supaClient';
import { useOptimizedRealtimeHandler } from './useOptimizedRealtimeHandler';

interface CommuteTimeCalculationResult {
  success: boolean;
  communitiesCount?: number;
  error?: string;
}

/**
 * 通勤时间计算 Realtime Hook
 * 使用优化的 realtime 处理器，避免 message handler 性能问题
 */
export const useCommuteTimeRealtime = () => {
  const [calculatingRecords, setCalculatingRecords] = useState<Set<string>>(new Set());
  const { getDebouncedHandler } = useOptimizedRealtimeHandler();
  const channelsRef = useRef<Map<string, any>>(new Map());

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

      // 启动realtime监听 - 已禁用，避免WebSocket不安全连接问题
      const channelName = `commute-calculation-${followupId}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'followups',
          filter: `id=eq.${followupId}`
        }, (payload) => {
          console.log('📡 [Realtime] 收到跟进记录更新:', payload);
          
          // 检查是否是通勤时间计算完成
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          if (newData.extended_data?.commute_times && 
              (!oldData.extended_data?.commute_times || 
               JSON.stringify(newData.extended_data.commute_times) !== JSON.stringify(oldData.extended_data.commute_times))) {
  
            
            // 使用防抖处理器避免性能问题
            const debouncedHandler = getDebouncedHandler(
              `commute-success-${followupId}`,
              () => {
                // 清除loading提示
                message.destroy();
                
                // 显示成功消息
                const communitiesCount = Object.keys(newData.extended_data.commute_times).length;
                const result: CommuteTimeCalculationResult = {
                  success: true,
                  communitiesCount
                };
                
                message.success(`通勤时间计算成功！已计算 ${communitiesCount} 个社区的通勤时间`);
                
                // 调用成功回调
                onSuccess?.(result);
                
                // 清理状态
                setCalculatingRecords(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(followupId);
                  return newSet;
                });
                
                // 取消订阅
                supabase.removeChannel(channel);
                channelsRef.current.delete(followupId);
              },
              100 // 100ms 防抖
            );
            
            debouncedHandler();
          }
        })
        .subscribe();

      // 保存channel引用
      channelsRef.current.set(followupId, channel);

      // 发送计算指令（异步执行，不等待结果）
      const { error } = await supabase.rpc('calculate_commute_times_for_worklocation', {
        p_followup_id: followupId,
        p_worklocation: worklocation
      });

      if (error) {
        console.error('❌ 通勤时间计算API调用失败:', error);
        message.destroy();
        const errorMsg = '通勤时间计算失败: ' + (error.message || '未知错误');
        message.error(errorMsg);
        onError?.(errorMsg);
        
        // 清理状态
        setCalculatingRecords(prev => {
          const newSet = new Set(prev);
          newSet.delete(followupId);
          return newSet;
        });
        supabase.removeChannel(channel);
        channelsRef.current.delete(followupId);
        return;
      }

      console.log('📤 [Realtime] 通勤时间计算指令已发送，等待realtime更新...');

      // 设置超时保护（60秒后自动取消监听）
      setTimeout(() => {
        if (calculatingRecords.has(followupId)) {
          console.log('⏰ [Realtime] 通勤时间计算超时，取消监听');
          message.destroy();
          message.warning('计算时间较长，请稍后刷新页面查看结果');
          
          // 清理状态
          setCalculatingRecords(prev => {
            const newSet = new Set(prev);
            newSet.delete(followupId);
            return newSet;
          });
          
          const channel = channelsRef.current.get(followupId);
          if (channel) {
            supabase.removeChannel(channel);
            channelsRef.current.delete(followupId);
          }
        }
      }, 60000);

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
  }, [calculatingRecords, getDebouncedHandler]);

  /**
   * 检查记录是否正在计算中
   */
  const isCalculating = useCallback((followupId: string) => {
    return calculatingRecords.has(followupId);
  }, [calculatingRecords]);

  /**
   * 清理所有订阅
   */
  const cleanup = useCallback(() => {
    channelsRef.current.forEach((channel, followupId) => {
      supabase.removeChannel(channel);
    });
    channelsRef.current.clear();
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
