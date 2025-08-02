import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { message } from 'antd';

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

export const useRealtimeConcurrencyControl = () => {
  const [editLocks, setEditLocks] = useState<{ [key: string]: EditLock }>({});
  const [timeSlotLocks, setTimeSlotLocks] = useState<{ [key: string]: TimeSlotLock }>({});
  const [currentUserLocks, setCurrentUserLocks] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const lockTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 添加连接状态变化的调试
  useEffect(() => {
  }, [isConnected]);

  // 防抖的连接状态设置
  const setConnectedWithDebounce = useCallback((connected: boolean) => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    connectionTimeoutRef.current = setTimeout(() => {
      setIsConnected(connected);
    }, 1000); // 1秒防抖
  }, []);

  // 获取当前用户ID
  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userProfile } = await supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return userProfile?.id;
  };

  // 检查用户5分钟内报名次数
  const checkUserRegisterLimit = useCallback(async () => {
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return { success: false, error: '用户未登录' };

      const { data: recentRegistrations } = await supabase
        .from('live_stream_schedules')
        .select('created_at')
        .eq('created_by', currentUserId)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (recentRegistrations && recentRegistrations.length >= 2) {
        return { 
          success: false, 
          error: '5分钟内最多只能报名2场直播',
          remainingTime: 5 * 60 - Math.floor((Date.now() - new Date(recentRegistrations[0].created_at).getTime()) / 1000)
        };
      }

      return { 
        success: true, 
        remainingRegisters: 2 - (recentRegistrations?.length || 0)
      };
    } catch (error) {
      return { success: false, error: '检查报名限制失败' };
    }
  }, []);

  // 尝试获取编辑锁定
  const acquireEditLock = useCallback(async (scheduleId: string) => {
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) throw new Error('用户未登录');

      // 检查是否已被锁定
      const existingLock = editLocks[scheduleId];
      if (existingLock && existingLock.editing_expires_at > new Date().toISOString()) {
        throw new Error(`该时间段正在被 ${existingLock.user_name} 编辑`);
      }

      // 检查时间段是否被锁定
      const timeSlotLock = timeSlotLocks[scheduleId];
      if (timeSlotLock) {
        throw new Error(`该时间段已被锁定: ${timeSlotLock.lock_reason}`);
      }

      // 检查用户5分钟内报名次数（只有创建新安排时才检查）
      const schedule = await supabase
        .from('live_stream_schedules')
        .select('created_by')
        .eq('id', scheduleId)
        .single();

      if (!schedule.data?.created_by) {
        // 新安排，检查报名限制
        const limitCheck = await checkUserRegisterLimit();
        if (!limitCheck.success) {
          throw new Error(limitCheck.error);
        }
      }

      // 直接更新数据库，realtime会自动通知其他用户
      const { data, error } = await supabase
        .from('live_stream_schedules')
        .update({
          status: 'editing',
          editing_by: currentUserId,
          editing_at: new Date().toISOString(),
          editing_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .eq('id', scheduleId)
        .select()
        .single();

      if (error) throw error;

      // 设置本地锁定状态
      setCurrentUserLocks(prev => new Set([...prev, scheduleId]));

      // 设置自动释放定时器
      const timeout = setTimeout(() => {
        releaseEditLock(scheduleId);
        message.warning('编辑超时，已自动释放锁定');
      }, 5 * 60 * 1000); // 5分钟

      lockTimeouts.current[scheduleId] = timeout;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [editLocks, timeSlotLocks, checkUserRegisterLimit]);

  // 释放编辑锁定
  const releaseEditLock = useCallback(async (scheduleId: string) => {
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return;

      // 清除定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
        delete lockTimeouts.current[scheduleId];
      }

      // 更新数据库
      await supabase
        .from('live_stream_schedules')
        .update({
          status: 'available',
          editing_by: null,
          editing_at: null,
          editing_expires_at: null
        })
        .eq('id', scheduleId)
        .eq('editing_by', currentUserId);

      // 更新本地状态
      setCurrentUserLocks(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        return newSet;
      });
    } catch (error) {
      console.error('释放锁定失败:', error);
    }
  }, []);

  // 延长编辑锁定
  const extendEditLock = useCallback(async (scheduleId: string) => {
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return;

      // 更新过期时间
      await supabase
        .from('live_stream_schedules')
        .update({
          editing_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .eq('id', scheduleId)
        .eq('editing_by', currentUserId);

      // 重置定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
      }

      const timeout = setTimeout(() => {
        releaseEditLock(scheduleId);
        message.warning('编辑超时，已自动释放锁定');
      }, 5 * 60 * 1000);

      lockTimeouts.current[scheduleId] = timeout;
    } catch (error) {
      console.error('延长锁定失败:', error);
    }
  }, [releaseEditLock]);

  // 实时监听状态变化
  useEffect(() => {

    const channel = supabase.channel('concurrency-control')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stream_schedules',
        filter: 'status=eq.editing'
      }, async (payload) => {
        const schedule = payload.new;

        if (schedule.editing_by) {
          // 获取编辑用户信息
          const { data: userProfile } = await supabase
            .from('users_profile')
            .select('nickname, email')
            .eq('id', schedule.editing_by)
            .single();

          const userName = userProfile?.nickname || userProfile?.email || '未知用户';

          setEditLocks(prev => ({
            ...prev,
            [schedule.id]: {
              editing_by: schedule.editing_by,
              editing_at: schedule.editing_at,
              editing_expires_at: schedule.editing_expires_at,
              user_name: userName
            }
          }));

          // 显示通知
          message.info(`${userName} 正在编辑 ${schedule.date} ${schedule.time_slot_id}`);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stream_schedules',
        filter: 'status=eq.available'
      }, (payload) => {
        const schedule = payload.new;

        setEditLocks(prev => {
          const newLocks = { ...prev };
          delete newLocks[schedule.id];
          return newLocks;
        });

        // 显示通知
        message.success(`${schedule.date} ${schedule.time_slot_id} 已可编辑`);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stream_schedules',
        filter: 'status=eq.locked'
      }, async (payload) => {
        const schedule = payload.new;

        setTimeSlotLocks(prev => ({
          ...prev,
          [schedule.id]: {
            lock_type: schedule.lock_type,
            lock_reason: schedule.lock_reason,
            lock_end_time: schedule.lock_end_time
          }
        }));

        // 显示通知
        message.warning(`${schedule.date} ${schedule.time_slot_id} 已被锁定`);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_schedules'
      }, async (payload) => {
        const schedule = payload.new;

        // 获取创建用户信息
        const { data: userProfile } = await supabase
          .from('users_profile')
          .select('nickname, email')
          .eq('id', schedule.created_by)
          .single();

        const userName = userProfile?.nickname || userProfile?.email || '未知用户';

        // 显示通知
        message.success(`${userName} 报名了 ${schedule.date} ${schedule.time_slot_id}`);
      })
      .on('system', { event: 'disconnect' }, () => {
        setConnectedWithDebounce(false);
      })
      .on('system', { event: 'reconnect' }, () => {
        setConnectedWithDebounce(true);
      })
      .subscribe((status) => {
        setConnectedWithDebounce(status === 'SUBSCRIBED');
      });

    return () => {
      // 清理所有定时器
      Object.values(lockTimeouts.current).forEach(timeout => clearTimeout(timeout));
      supabase.removeChannel(channel);
    };
  }, []);

  // 自动延长锁定（每分钟）
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const scheduleId of currentUserLocks) {
        await extendEditLock(scheduleId);
      }
    }, 60000); // 每分钟

    return () => clearInterval(interval);
  }, [currentUserLocks, extendEditLock]);

  // 页面卸载时释放所有锁定
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
    checkUserRegisterLimit,
    isBeingEdited: (scheduleId: string) => {
      const lock = editLocks[scheduleId];
      return lock && lock.editing_expires_at > new Date().toISOString();
    },
    isLocked: (scheduleId: string) => !!timeSlotLocks[scheduleId],
    isBeingEditedByCurrentUser: (scheduleId: string) => currentUserLocks.has(scheduleId),
    getEditLockInfo: (scheduleId: string) => editLocks[scheduleId],
    getTimeSlotLockInfo: (scheduleId: string) => timeSlotLocks[scheduleId]
  };
}; 