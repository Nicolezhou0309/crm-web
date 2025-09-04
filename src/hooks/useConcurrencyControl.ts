/**
 * 并发控制Hook - 禁用Realtime版本
 * 用于替代useRealtimeConcurrencyControl，避免WebSocket混合内容问题
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { message } from 'antd';
import { useUser } from '../context/UserContext';

interface EditLock {
  editing_by: number;
  editing_at: string;
  editing_expires_at: string;
  user_name: string;
}

interface TimeSlotLock {
  lock_type: string;
  lock_reason: string;
  lock_end_time: string;
}

export const useConcurrencyControl = () => {
  const [editLocks, setEditLocks] = useState<{ [key: string]: EditLock }>({});
  const [timeSlotLocks, setTimeSlotLocks] = useState<{ [key: string]: TimeSlotLock }>({});
  const [currentUserLocks, setCurrentUserLocks] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const lockTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const { getCachedUserInfo } = useUser();
  const { user } = useUser();

  // 轮询间隔（毫秒）
  const POLLING_INTERVAL = 5000; // 5秒
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取当前用户ID
  const getCurrentUserId = async () => {
    if (!user) return null;

    const { data: userProfile } = await supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return userProfile?.id || null;
  };

  // 检查编辑锁定状态
  const checkEditLocks = useCallback(async () => {
    try {
      const { data: schedules, error } = await supabase
        .from('live_stream_schedules')
        .select('id, editing_by, editing_at, editing_expires_at, status, date, time_slot_id')
        .in('status', ['editing', 'available', 'booked', 'locked']);

      if (error) {
        console.error('❌ [ConcurrencyControl] 获取编辑锁定状态失败:', error);
        return;
      }

      const newEditLocks: { [key: string]: EditLock } = {};
      const newTimeSlotLocks: { [key: string]: TimeSlotLock } = {};

      for (const schedule of schedules || []) {
        if (schedule.status === 'editing' && schedule.editing_by) {
          // 获取用户信息
          const { data: userProfile } = await supabase
            .from('users_profile')
            .select('nickname, email')
            .eq('id', schedule.editing_by)
            .single();

          const userName = userProfile?.nickname || userProfile?.email || '未知用户';

          newEditLocks[schedule.id] = {
            editing_by: schedule.editing_by,
            editing_at: schedule.editing_at,
            editing_expires_at: schedule.editing_expires_at,
            user_name: userName
          };
        } else if (schedule.status === 'locked') {
          newTimeSlotLocks[schedule.id] = {
            lock_type: 'time_slot',
            lock_reason: '时间段被锁定',
            lock_end_time: schedule.lock_end_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          };
        }
      }

      setEditLocks(newEditLocks);
      setTimeSlotLocks(newTimeSlotLocks);
      setIsConnected(true);

    } catch (error) {
      console.error('❌ [ConcurrencyControl] 检查编辑锁定状态失败:', error);
      setIsConnected(false);
    }
  }, []);

  // 开始轮询
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    console.log('🔄 [ConcurrencyControl] 开始轮询检查编辑锁定状态');
    checkEditLocks(); // 立即执行一次

    pollingIntervalRef.current = setInterval(() => {
      checkEditLocks();
    }, POLLING_INTERVAL);
  }, [checkEditLocks]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 [ConcurrencyControl] 停止轮询');
    }
  }, []);

  // 获取编辑锁定
  const acquireEditLock = useCallback(async (scheduleId: string): Promise<boolean> => {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      message.error('无法获取用户信息');
      return false;
    }

    try {
      const { error } = await supabase
        .from('live_stream_schedules')
        .update({
          status: 'editing',
          editing_by: currentUserId,
          editing_at: new Date().toISOString(),
          editing_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5分钟过期
        })
        .eq('id', scheduleId)
        .eq('status', 'available');

      if (error) {
        console.error('❌ [ConcurrencyControl] 获取编辑锁定失败:', error);
        message.error('获取编辑锁定失败');
        return false;
      }

      // 添加到当前用户锁定列表
      setCurrentUserLocks(prev => new Set(prev).add(scheduleId));

      // 设置自动释放定时器
      const timeout = setTimeout(() => {
        releaseEditLock(scheduleId);
      }, 5 * 60 * 1000); // 5分钟后自动释放

      lockTimeouts.current[scheduleId] = timeout;

      message.success('已获取编辑锁定');
      return true;

    } catch (error) {
      console.error('❌ [ConcurrencyControl] 获取编辑锁定异常:', error);
      message.error('获取编辑锁定失败');
      return false;
    }
  }, []);

  // 释放编辑锁定
  const releaseEditLock = useCallback(async (scheduleId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('live_stream_schedules')
        .update({
          status: 'available',
          editing_by: null,
          editing_at: null,
          editing_expires_at: null
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('❌ [ConcurrencyControl] 释放编辑锁定失败:', error);
        return;
      }

      // 从当前用户锁定列表移除
      setCurrentUserLocks(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        return newSet;
      });

      // 清除定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
        delete lockTimeouts.current[scheduleId];
      }

      console.log('✅ [ConcurrencyControl] 编辑锁定已释放:', scheduleId);

    } catch (error) {
      console.error('❌ [ConcurrencyControl] 释放编辑锁定异常:', error);
    }
  }, []);

  // 延长编辑锁定
  const extendEditLock = useCallback(async (scheduleId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('live_stream_schedules')
        .update({
          editing_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('❌ [ConcurrencyControl] 延长编辑锁定失败:', error);
        return;
      }

      // 重新设置定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
      }

      const timeout = setTimeout(() => {
        releaseEditLock(scheduleId);
      }, 5 * 60 * 1000);

      lockTimeouts.current[scheduleId] = timeout;

      console.log('✅ [ConcurrencyControl] 编辑锁定已延长:', scheduleId);

    } catch (error) {
      console.error('❌ [ConcurrencyControl] 延长编辑锁定异常:', error);
    }
  }, [releaseEditLock]);

  // 检查是否被当前用户锁定
  const isLockedByCurrentUser = useCallback((scheduleId: string): boolean => {
    return currentUserLocks.has(scheduleId);
  }, [currentUserLocks]);

  // 检查是否被其他用户锁定
  const isLockedByOtherUser = useCallback((scheduleId: string): boolean => {
    return editLocks[scheduleId] !== undefined && !currentUserLocks.has(scheduleId);
  }, [editLocks, currentUserLocks]);

  // 获取锁定用户信息
  const getLockUserInfo = useCallback((scheduleId: string): EditLock | null => {
    return editLocks[scheduleId] || null;
  }, [editLocks]);

  // 组件挂载时开始轮询
  useEffect(() => {
    startPolling();

    return () => {
      stopPolling();
      // 清理所有定时器
      Object.values(lockTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [startPolling, stopPolling]);

  // 组件卸载时释放所有锁定
  useEffect(() => {
    return () => {
      currentUserLocks.forEach(scheduleId => {
        releaseEditLock(scheduleId);
      });
    };
  }, [currentUserLocks, releaseEditLock]);

  return {
    editLocks,
    timeSlotLocks,
    currentUserLocks,
    isConnected,
    acquireEditLock,
    releaseEditLock,
    extendEditLock,
    isLockedByCurrentUser,
    isLockedByOtherUser,
    getLockUserInfo,
    startPolling,
    stopPolling
  };
};
