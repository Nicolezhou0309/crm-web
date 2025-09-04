import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { message } from 'antd';
import { useUser } from '../context/UserContext';
import { realtimeService } from '../services/RealtimeService';

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
  const { getCachedUserInfo } = useUser();
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useUser();

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

  // 获取当前用户ID - 使用统一的用户上下文
  const getCurrentUserId = async () => {
    if (!user) return null;

    const { data: userProfile } = await supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return userProfile?.id;
  };


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
        // 新安排，直接允许创建
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
  }, [editLocks, timeSlotLocks]);

  // 释放编辑锁定
  const releaseEditLock = useCallback(async (scheduleId: string) => {
    try {
      
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        return;
      }


      // 清除定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
        delete lockTimeouts.current[scheduleId];
      }

      // 先获取当前记录状态
      const { data: currentRecord } = await supabase
        .from('live_stream_schedules')
        .select('status')
        .eq('id', scheduleId)
        .single();


      // 根据当前状态决定是否重置状态
      const shouldResetStatus = currentRecord?.status !== 'booked';
      
      
      // 更新数据库
      const updateData: any = {
        editing_by: null,
        editing_at: null,
        editing_expires_at: null
      };

      // 只有非booked状态才重置为available
      if (shouldResetStatus) {
        updateData.status = 'available';
      }

      const { error } = await supabase
        .from('live_stream_schedules')
        .update(updateData)
        .eq('id', scheduleId)
        .eq('editing_by', currentUserId)
        .select();

      if (error) {
        console.error('❌ 释放编辑锁定失败:', error);
        throw error;
      }


      // 更新本地状态
      setCurrentUserLocks(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        return newSet;
      });
    } catch (error) {
      console.error('❌ 释放锁定失败:', error);
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

    // 实时监听状态变化 - 使用统一的RealtimeService
  useEffect(() => {
    console.log('🔄 [Realtime] 启用 realtime 功能');
    
    // 使用统一的RealtimeService替代直接创建channel
    const subscriptionId = realtimeService.subscribe({
      table: 'live_stream_schedules',
      event: 'UPDATE',
      filter: 'status=eq.editing',
      callback: async (payload) => {
        console.log('📡 [Realtime] 收到 editing 状态更新事件:', {
          eventType: 'UPDATE',
          table: 'live_stream_schedules',
          filter: 'status=eq.editing',
          payload: {
            old: payload.old,
            new: payload.new,
            commit_timestamp: payload.commit_timestamp
          }
        });
        
        const schedule = payload.new;

        if (schedule.editing_by) {
          console.log('👤 [Realtime] 开始获取编辑用户信息:', { editing_by: schedule.editing_by });
          
          // 获取编辑用户信息
          const { data: userProfile } = await supabase
            .from('users_profile')
            .select('nickname, email')
            .eq('id', schedule.editing_by)
            .single();

          const userName = userProfile?.nickname || userProfile?.email || '未知用户';
          console.log('✅ [Realtime] 获取到用户信息:', { 
            editing_by: schedule.editing_by, 
            user_name: userName,
            user_profile: userProfile 
          });

          setEditLocks(prev => {
            const newLocks = {
              ...prev,
              [schedule.id]: {
                editing_by: schedule.editing_by,
                editing_at: schedule.editing_at,
                editing_expires_at: schedule.editing_expires_at,
                user_name: userName
              }
            };
            console.log('🔒 [Realtime] 更新编辑锁定状态:', {
              schedule_id: schedule.id,
              new_lock: newLocks[schedule.id as keyof typeof newLocks],
              all_locks: newLocks
            });
            return newLocks;
          });

          // 显示通知
          const notificationMessage = `${userName} 正在编辑 ${schedule.date} ${schedule.time_slot_id}`;
          console.log('📢 [Realtime] 显示通知:', notificationMessage);
          message.info(notificationMessage);
        } else {
          console.log('⚠️ [Realtime] editing_by 为空，跳过处理');
        }
      }
    });

    // 添加available状态监听
    const availableSubscriptionId = realtimeService.subscribe({
      table: 'live_stream_schedules',
      event: 'UPDATE',
      filter: 'status=eq.available',
      callback: (payload) => {
        console.log('📡 [Realtime] 收到 available 状态更新事件:', {
          eventType: 'UPDATE',
          table: 'live_stream_schedules',
          filter: 'status=eq.available',
          payload: {
            old: payload.old,
            new: payload.new,
            commit_timestamp: payload.commit_timestamp
          }
        });
        
        const schedule = payload.new;

        setEditLocks(prev => {
          const newLocks = { ...prev };
          const deletedLock = newLocks[schedule.id];
          delete newLocks[schedule.id];
          console.log('🔓 [Realtime] 清除编辑锁定状态:', {
            schedule_id: schedule.id,
            deleted_lock: deletedLock,
            remaining_locks: newLocks
          });
          return newLocks;
        });

        // 显示通知
        const notificationMessage = `${schedule.date} ${schedule.time_slot_id} 已可编辑`;
        console.log('📢 [Realtime] 显示通知:', notificationMessage);
        message.success(notificationMessage);
      }
    });

    // 添加booked状态监听
    const bookedSubscriptionId = realtimeService.subscribe({
      table: 'live_stream_schedules',
      event: 'UPDATE',
      filter: 'status=eq.booked',
      callback: async (payload: any) => {
        console.log('📡 [Realtime] 收到 booked 状态更新事件:', {
          eventType: 'UPDATE',
          table: 'live_stream_schedules',
          filter: 'status=eq.booked',
          payload: {
            old: payload.old,
            new: payload.new,
            commit_timestamp: payload.commit_timestamp
          }
        });
        
        const schedule = payload.new;

        // 清除编辑锁定
        setEditLocks(prev => {
          const newLocks = { ...prev };
          const deletedLock = newLocks[schedule.id];
          delete newLocks[schedule.id];
          console.log('🔓 [Realtime] 清除编辑锁定状态 (booked):', {
            schedule_id: schedule.id,
            deleted_lock: deletedLock,
            remaining_locks: newLocks
          });
          return newLocks;
        });

        // 获取报名用户信息
        console.log('👤 [Realtime] 开始获取报名用户信息:', { created_by: schedule.created_by });
        const { data: userProfile } = await supabase
          .from('users_profile')
          .select('nickname, email')
          .eq('id', schedule.created_by)
            .single();

        const userName = userProfile?.nickname || userProfile?.email || '未知用户';
        console.log('✅ [Realtime] 获取到报名用户信息:', { 
          created_by: schedule.created_by, 
          user_name: userName,
          user_profile: userProfile 
        });

        // 显示通知
        const notificationMessage = `${userName} 报名了 ${schedule.date} ${schedule.time_slot_id}`;
        console.log('📢 [Realtime] 显示通知:', notificationMessage);
        message.success(notificationMessage);
      }
    });

    // 添加locked状态监听
    const lockedSubscriptionId = realtimeService.subscribe({
      table: 'live_stream_schedules',
      event: 'UPDATE',
      filter: 'status=eq.locked',
      callback: async (payload: any) => {
        console.log('📡 [Realtime] 收到 locked 状态更新事件:', {
          eventType: 'UPDATE',
          table: 'live_stream_schedules',
          filter: 'status=eq.locked',
          payload: {
            old: payload.old,
            new: payload.new,
            commit_timestamp: payload.commit_timestamp
          }
        });
        
        const schedule = payload.new;

        setTimeSlotLocks(prev => {
          const newLocks = {
            ...prev,
            [schedule.id]: {
              lock_type: schedule.lock_type,
              lock_reason: schedule.lock_reason,
              lock_end_time: schedule.lock_end_time
            }
          };
          console.log('🔒 [Realtime] 更新时间段锁定状态:', {
            schedule_id: schedule.id,
            new_lock: newLocks[schedule.id as keyof typeof newLocks],
            all_locks: newLocks
          });
          return newLocks;
        });

        // 显示通知
        const notificationMessage = `${schedule.date} ${schedule.time_slot_id} 已被锁定`;
        console.log('📢 [Realtime] 显示通知:', notificationMessage);
        message.warning(notificationMessage);
      }
    });

    // 添加INSERT事件监听
    const insertSubscriptionId = realtimeService.subscribe({
      table: 'live_stream_schedules',
      event: 'INSERT',
      callback: async (payload: any) => {
        const startTime = performance.now();
        
        try {
          console.log('📡 [Realtime] 收到 INSERT 事件:', {
            eventType: 'INSERT',
            table: 'live_stream_schedules',
            payload: {
              new: payload.new,
              commit_timestamp: payload.commit_timestamp
            }
          });
          
          const schedule = payload.new;

          // 立即显示基础通知，异步更新用户信息
          const basicMessage = `有人报名了 ${schedule.date} ${schedule.time_slot_id}`;
          message.success(basicMessage);
          
          // 异步获取详细用户信息并更新通知（使用缓存）
          getCachedUserInfo(schedule.created_by.toString()).then(userInfo => {
            if (userInfo.displayName !== '未知用户') {
              const detailedMessage = `${userInfo.displayName} 报名了 ${schedule.date} ${schedule.time_slot_id}`;
              // 可以在这里添加更详细的通知逻辑
              console.log('📢 [Realtime] 详细通知:', detailedMessage);
            }
          });
          
        } finally {
          const duration = performance.now() - startTime;
          if (duration > 100) {
            console.warn(`⚠️ [实时性能] INSERT 事件处理耗时 ${duration.toFixed(2)}ms`);
          }
        }
      }
    });

    // 监听连接状态变化
    const connectionInfo = realtimeService.getConnectionInfo();
    setConnectedWithDebounce(connectionInfo.isConnected);

    return () => {
      // 清理所有定时器
      Object.values(lockTimeouts.current).forEach(timeout => clearTimeout(timeout));
      // 使用realtimeService取消订阅
      if (subscriptionId) realtimeService.unsubscribe(subscriptionId);
      if (availableSubscriptionId) realtimeService.unsubscribe(availableSubscriptionId);
      if (bookedSubscriptionId) realtimeService.unsubscribe(bookedSubscriptionId);
      if (lockedSubscriptionId) realtimeService.unsubscribe(lockedSubscriptionId);
      if (insertSubscriptionId) realtimeService.unsubscribe(insertSubscriptionId);
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