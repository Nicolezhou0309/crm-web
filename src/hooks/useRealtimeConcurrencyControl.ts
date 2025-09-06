import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supaClient';
import { message } from 'antd';
import { useUser } from '../context/UserContext';
import { realtimeManager } from '../services/RealtimeManager';

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

interface RealtimeDataChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  scheduleId: string;
  schedule?: any;
  oldSchedule?: any;
  statusChange?: {
    from: string;
    to: string;
  };
}

interface UseRealtimeConcurrencyControlOptions {
  onDataChange?: (change: RealtimeDataChange) => void; // 数据变化回调，包含具体变化信息
}

export const useRealtimeConcurrencyControl = (options?: UseRealtimeConcurrencyControlOptions) => {
  const [editLocks, setEditLocks] = useState<{ [key: string]: EditLock }>({});
  const [timeSlotLocks, setTimeSlotLocks] = useState<{ [key: string]: TimeSlotLock }>({});
  const [currentUserLocks, setCurrentUserLocks] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const lockTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const { getCachedUserInfo, user, profile } = useUser();
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 监听 RealtimeManager 连接状态变化
  useEffect(() => {
    const updateConnectionStatus = () => {
      const stats = realtimeManager.getStats();
      const connected = stats.isConnected;
      setIsConnected(connected);
      console.log('🔄 [Realtime] 连接状态变化:', { 
        connected, 
        activeSubscriptions: stats.activeSubscriptions,
        hasActiveSubscription: subscriptionRef.current.hasActiveSubscription
      });
    };

    // 初始状态
    updateConnectionStatus();

    // 监听 RealtimeManager 状态变化事件
    const handleStateChange = () => {
      updateConnectionStatus();
    };

    // 注册事件监听器
    realtimeManager.addEventListener?.('stateChange', handleStateChange);

    return () => {
      // 清理事件监听器
      realtimeManager.removeEventListener?.('stateChange', handleStateChange);
    };
  }, []);

  // 防抖的连接状态设置
  const setConnectedWithDebounce = useCallback((connected: boolean) => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    connectionTimeoutRef.current = setTimeout(() => {
      setIsConnected(connected);
    }, 1000); // 1秒防抖
  }, []);

  // 重连函数 - 移除自动重连，让 RealtimeManager 统一处理
  const scheduleReconnect = useCallback(() => {
    // 不再自动重连，让 RealtimeManager 统一处理重连逻辑
    console.log('🔄 [Realtime] 连接断开，等待 RealtimeManager 自动重连...');
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
    console.log('🔒 [acquireEditLock] 开始获取编辑锁定:', {
      scheduleId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) throw new Error('用户未登录');
      
      console.log('🔒 [acquireEditLock] 当前用户ID:', currentUserId);

      // 检查是否已被锁定
      const existingLock = editLocks[scheduleId];
      console.log('🔒 [acquireEditLock] 检查现有锁定:', {
        scheduleId,
        existingLock,
        isExpired: existingLock ? existingLock.editing_expires_at <= new Date().toISOString() : true
      });
      
      if (existingLock && existingLock.editing_expires_at > new Date().toISOString()) {
        console.warn('⚠️ [acquireEditLock] 时间段已被锁定:', existingLock);
        throw new Error(`该时间段正在被 ${existingLock.user_name} 编辑`);
      }

      // 检查时间段是否被锁定
      const timeSlotLock = timeSlotLocks[scheduleId];
      console.log('🔒 [acquireEditLock] 检查时间段锁定:', {
        scheduleId,
        timeSlotLock
      });
      
      if (timeSlotLock) {
        console.warn('⚠️ [acquireEditLock] 时间段被锁定:', timeSlotLock);
        throw new Error(`该时间段已被锁定: ${timeSlotLock.lock_reason}`);
      }

      // 检查用户5分钟内报名次数（只有创建新安排时才检查）
      const schedule = await supabase
        .from('live_stream_schedules')
        .select('created_by')
        .eq('id', parseInt(scheduleId))
        .single();

      if (!schedule.data?.created_by) {
        // 新安排，直接允许创建
      }

      // 直接更新数据库，realtime会自动通知其他用户
      const editingAt = new Date().toISOString();
      const editingExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      console.log('🔒 [acquireEditLock] 更新数据库状态为editing:', {
        scheduleId,
        currentUserId,
        editing_at: editingAt,
        editing_expires_at: editingExpiresAt,
        lock_duration_minutes: 5
      });
      
      const { data, error } = await supabase
        .from('live_stream_schedules')
        .update({
          status: 'editing',
          editing_by: currentUserId,
          editing_at: editingAt,
          editing_expires_at: editingExpiresAt
        })
        .eq('id', parseInt(scheduleId))
        .select()
        .single();

      console.log('🔒 [acquireEditLock] 数据库更新结果:', {
        success: !error,
        error: error?.message,
        data: data
      });

      if (error) throw error;

      // 设置本地锁定状态
      console.log('🔒 [acquireEditLock] 设置本地锁定状态:', scheduleId);
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
      console.log('🔓 [releaseEditLock] 开始释放编辑锁定:', {
        scheduleId,
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(1, 5).join('\n')
      });
      
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        console.log('🔓 [releaseEditLock] 用户未登录，跳过释放锁定:', scheduleId);
        return;
      }

      console.log('🔓 [releaseEditLock] 当前用户ID:', currentUserId);

      // 清除定时器
      if (lockTimeouts.current[scheduleId]) {
        clearTimeout(lockTimeouts.current[scheduleId]);
        delete lockTimeouts.current[scheduleId];
        console.log('🔓 [releaseEditLock] 清除定时器:', scheduleId);
      }

      // 先获取当前记录状态
      const { data: currentRecord } = await supabase
        .from('live_stream_schedules')
        .select('status')
        .eq('id', parseInt(scheduleId))
        .single();

      console.log('🔓 [releaseEditLock] 当前记录状态:', {
        scheduleId,
        currentRecord,
        status: currentRecord?.status
      });

      // 根据当前状态决定是否重置状态
      const shouldResetStatus = currentRecord?.status !== 'booked';
      
      console.log('🔓 [releaseEditLock] 是否重置状态:', {
        scheduleId,
        shouldResetStatus,
        currentStatus: currentRecord?.status
      });
      
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

      console.log('🔓 [releaseEditLock] 准备更新数据库:', {
        scheduleId,
        updateData,
        currentUserId
      });

      const { error } = await supabase
        .from('live_stream_schedules')
        .update(updateData)
        .eq('id', parseInt(scheduleId))
        .eq('editing_by', currentUserId)
        .select();

      if (error) {
        console.error('❌ [releaseEditLock] 释放编辑锁定失败:', error);
        throw error;
      }

      console.log('✅ [releaseEditLock] 数据库更新成功:', scheduleId);

      // 更新本地状态
      setCurrentUserLocks(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        console.log('🔓 [releaseEditLock] 更新本地锁定状态:', {
          scheduleId,
          beforeSize: prev.size,
          afterSize: newSet.size,
          removedLock: scheduleId
        });
        return newSet;
      });
      
      console.log('✅ [releaseEditLock] 编辑锁定释放完成:', scheduleId);
    } catch (error) {
      console.error('❌ [releaseEditLock] 释放锁定失败:', error);
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
        .eq('id', parseInt(scheduleId))
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

  // 使用 ref 来跟踪订阅状态，避免闭包问题
  const subscriptionRef = useRef<{
    isSubscribing: boolean;
    subscriptionIds: string[];
    hasActiveSubscription: boolean; // 新增：跟踪是否有活跃订阅
    lastSubscriptionAttempt: number; // 记录最后订阅尝试时间
  }>({
    isSubscribing: false,
    subscriptionIds: [],
    hasActiveSubscription: false,
    lastSubscriptionAttempt: 0
  });

  // 组件挂载时清理可能存在的旧订阅
  useEffect(() => {
    // 组件挂载时立即清理可能存在的旧订阅
    if (subscriptionRef.current.hasActiveSubscription) {
      console.log('🗑️ [Realtime] 组件挂载时清理旧订阅');
      // 不再直接取消订阅，由 RealtimeManager 统一管理
      console.log('🗑️ [Realtime] 清理旧订阅状态');
      // 重置订阅状态
      subscriptionRef.current = {
        isSubscribing: false,
        subscriptionIds: [],
        hasActiveSubscription: false,
        lastSubscriptionAttempt: 0
      };
    }

    return () => {
      // 清理重连定时器
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      // 组件卸载时清理所有订阅
      console.log('🗑️ [Realtime] 组件卸载时清理订阅');
      // 不再直接取消订阅，由 RealtimeManager 统一管理
      // 重置订阅状态
      subscriptionRef.current = {
        isSubscribing: false,
        subscriptionIds: [],
        hasActiveSubscription: false,
        lastSubscriptionAttempt: 0
      };
    };
  }, []); // 空依赖数组，只在组件挂载/卸载时执行



  // 监听 RealtimeManager 的订阅状态变化
  useEffect(() => {
    if (!profile?.id) return;
    
    const updateSubscriptionStatus = () => {
      const stats = realtimeManager.getStats();
      const hasActiveSubscriptions = stats.activeSubscriptions > 0;
      const currentHasActive = subscriptionRef.current.hasActiveSubscription;
      
      console.log('🔄 [Realtime] 状态检查:', {
        managerActiveSubscriptions: stats.activeSubscriptions,
        localHasActive: currentHasActive,
        localSubscriptionIds: subscriptionRef.current.subscriptionIds.length,
        isSubscribing: subscriptionRef.current.isSubscribing
      });
      
      // 如果 RealtimeManager 有活跃订阅但本地没有，说明订阅是由 RealtimeManager 创建的
      if (hasActiveSubscriptions && !currentHasActive && !subscriptionRef.current.isSubscribing) {
        console.log('🔄 [Realtime] 检测到 RealtimeManager 创建的订阅，同步状态');
        subscriptionRef.current.hasActiveSubscription = true;
        
        // 从 stats 中获取订阅信息
        if (stats.subscriptions) {
          const concurrencySubscriptions = stats.subscriptions.filter(
            (sub: any) => sub.source === 'ConcurrencyControl' && sub.table === 'live_stream_schedules'
          );
          subscriptionRef.current.subscriptionIds = concurrencySubscriptions.map((sub: any) => sub.id);
          console.log('✅ [Realtime] 同步订阅状态:', subscriptionRef.current.subscriptionIds);
        }
      }
      // 如果 RealtimeManager 没有活跃订阅但本地有，说明订阅被清理了
      else if (!hasActiveSubscriptions && currentHasActive) {
        console.log('🔄 [Realtime] 检测到订阅被清理，重置状态');
        subscriptionRef.current = {
          isSubscribing: false,
          subscriptionIds: [],
          hasActiveSubscription: false,
          lastSubscriptionAttempt: 0
        };
      }
    };

    // 初始状态
    updateSubscriptionStatus();

    // 监听订阅状态变化事件
    const handleSubscriptionChange = () => {
      updateSubscriptionStatus();
    };

    // 注册事件监听器
    realtimeManager.addEventListener?.('subscriptionChange', handleSubscriptionChange);

    return () => {
      // 清理事件监听器
      realtimeManager.removeEventListener?.('subscriptionChange', handleSubscriptionChange);
    };
  }, [profile?.id]);

  // 处理 INSERT 事件
  const handleInsertEvent = useCallback(async (schedule: any) => {
      // 安全检查
      if (!schedule || !schedule.id) {
        console.warn('⚠️ [Realtime] INSERT 事件数据无效:', schedule);
        return;
      }

      const startTime = performance.now();
      
      try {
        // 卡片已经渲染变化，无需显示通知
        console.log('📢 [Realtime] INSERT 事件处理完成，卡片已更新:', {
          scheduleId: schedule.id,
          date: schedule.date,
          timeSlotId: schedule.time_slot_id
        });
        
        // 通知主组件数据已变化
        if (options?.onDataChange) {
          console.log('🔄 [Realtime] 通知主组件数据变化 (INSERT)');
          options.onDataChange({
            eventType: 'INSERT',
            scheduleId: schedule.id.toString(),
            schedule: schedule
          });
        }
        
      } finally {
        const duration = performance.now() - startTime;
        if (duration > 100) {
          console.warn(`⚠️ [实时性能] INSERT 事件处理耗时 ${duration.toFixed(2)}ms`);
        }
      }
    }, [getCachedUserInfo, options]);

  // 处理 UPDATE 事件 - 基于状态字段变化
  const handleUpdateEvent = useCallback(async (schedule: any, oldSchedule: any) => {
      // 安全检查
      if (!schedule || !schedule.id) {
        console.warn('⚠️ [Realtime] UPDATE 事件数据无效:', schedule);
        return;
      }

      const status = schedule.status;
      const oldStatus = oldSchedule?.status;

      console.log('🔄 [Realtime] 状态变化检测:', {
        schedule_id: schedule.id,
        old_status: oldStatus,
        new_status: status,
        has_status_change: oldStatus !== status
      });

      // 只有状态真正发生变化时才处理
      if (oldStatus === status) {
        console.log('🔄 [Realtime] 状态未变化，跳过处理:', schedule.id);
        return;
      }

      // 状态变化处理
      if (status === 'editing' && schedule.editing_by) {
        await handleEditingStatus(schedule);
      } else if (status === 'available') {
        await handleAvailableStatus(schedule);
      } else if (status === 'booked') {
        await handleBookedStatus(schedule);
      } else if (status === 'locked') {
        await handleLockedStatus(schedule);
      }

      // 状态从 editing 变为其他状态时清除编辑锁定
      if (oldStatus === 'editing' && status !== 'editing') {
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
      }

      // 通知主组件状态变化
      if (options?.onDataChange) {
        console.log('🔄 [Realtime] 通知主组件状态变化:', {
          scheduleId: schedule.id.toString(),
          oldStatus,
          newStatus: status
        });
        options.onDataChange({
          eventType: 'STATUS_CHANGE',
          scheduleId: schedule.id.toString(),
          schedule: schedule,
          oldSchedule: oldSchedule,
          statusChange: {
            from: oldStatus,
            to: status
          }
        });
      }
    }, [options]);

  // 处理 DELETE 事件
  const handleDeleteEvent = useCallback(async (schedule: any) => {
      // 安全检查
      if (!schedule || !schedule.id) {
        console.warn('⚠️ [Realtime] DELETE 事件数据无效:', schedule);
        return;
      }

      console.log('🗑️ [Realtime] 处理 DELETE 事件:', schedule.id);
      // 可以在这里添加删除相关的处理逻辑
      
      // 通知主组件数据已变化
      if (options?.onDataChange) {
        console.log('🔄 [Realtime] 通知主组件数据变化 (DELETE)');
        options.onDataChange({
          eventType: 'DELETE',
          scheduleId: schedule.id.toString(),
          schedule: schedule
        });
      }
    }, [options]);

  // 使用 ref 存储稳定的回调函数，避免重复订阅
  const handleDataChangeRef = useRef<((payload: any) => Promise<void>) | null>(null);
  
  // 创建数据变化处理函数
  const handleDataChange = useCallback(async (payload: any) => {
    console.log(`📡 [Realtime] 收到原始 payload:`, payload);
    
    // Supabase postgres_changes 事件的结构
    // payload 包含: { eventType: 'INSERT'|'UPDATE'|'DELETE', new: {...}, old: {...}, ... }
    const eventType = payload.eventType; // INSERT, UPDATE, DELETE
    const schedule = payload.new || payload.old;
    
    console.log(`📡 [Realtime] 处理数据变化: ${eventType}`, {
      eventType,
      table: 'live_stream_schedules',
      schedule_id: schedule?.id,
      status: schedule?.status,
      editing_by: schedule?.editing_by,
      editing_at: schedule?.editing_at,
      editing_expires_at: schedule?.editing_expires_at,
      payload: {
        old: payload.old,
        new: payload.new,
        commit_timestamp: payload.commit_timestamp
      }
    });

    // 根据事件类型和状态处理
    if (eventType === 'INSERT') {
      await handleInsertEvent(schedule);
    } else if (eventType === 'UPDATE') {
      await handleUpdateEvent(schedule, payload.old);
    } else if (eventType === 'DELETE') {
      // DELETE 事件使用 payload.old（被删除的记录）
      await handleDeleteEvent(payload.old);
    }
  }, [handleInsertEvent, handleUpdateEvent, handleDeleteEvent]);
  
  // 更新 ref 中的回调函数
  useEffect(() => {
    handleDataChangeRef.current = handleDataChange;
  }, [handleDataChange]);

  // 使用 ref 存储订阅ID，避免重复订阅
  const subscriptionIdRef = useRef<string | null>(null);
  
  // 通过 RealtimeManager 订阅数据变化
  useEffect(() => {
    if (!profile?.id) return;
    
    console.log('🔄 [Realtime] 订阅数据变化', { 
      profileId: profile.id,
      existingSubscriptionId: subscriptionIdRef.current,
      stack: new Error().stack?.split('\n').slice(1, 5).join('\n')
    });
    
    // 如果已经有订阅，先取消
    if (subscriptionIdRef.current) {
      console.log('🗑️ [Realtime] 取消现有订阅:', subscriptionIdRef.current);
      realtimeManager.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
    
    // 创建稳定的回调函数
    const stableCallback = (payload: any) => {
      console.log('📡 [Realtime] 稳定回调函数被调用:', payload);
      if (handleDataChangeRef.current) {
        handleDataChangeRef.current(payload);
      } else {
        console.warn('⚠️ [Realtime] handleDataChangeRef.current 为空');
      }
    };
    
    // 通过 RealtimeManager 订阅数据变化
    realtimeManager.subscribe(
      profile.id.toString(),
      {
        table: 'live_stream_schedules',
        event: '*',
        source: 'ConcurrencyControl'
      },
      stableCallback
    ).then(id => {
      subscriptionIdRef.current = id;
      console.log('✅ [Realtime] 数据变化订阅成功:', id);
    }).catch(error => {
      console.error('❌ [Realtime] 数据变化订阅失败:', error);
    });
    
    return () => {
      console.log('🗑️ [Realtime] 取消数据变化订阅');
      if (subscriptionIdRef.current) {
        realtimeManager.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [profile?.id]); // 只依赖 profile?.id

  // 处理 editing 状态
  const handleEditingStatus = useCallback(async (schedule: any) => {
      console.log('👤 [Realtime] 开始获取编辑用户信息:', { editing_by: schedule.editing_by });
      
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

      console.log('📢 [Realtime] 编辑状态更新，卡片已渲染:', {
        scheduleId: schedule.id,
        userName,
        date: schedule.date,
        timeSlotId: schedule.time_slot_id
      });
    }, []);

  // 处理 available 状态
  const handleAvailableStatus = useCallback(async (schedule: any) => {
      console.log('📢 [Realtime] 可用状态更新，卡片已渲染:', {
        scheduleId: schedule.id,
        date: schedule.date,
        timeSlotId: schedule.time_slot_id
      });
    }, []);

  // 处理 booked 状态
  const handleBookedStatus = useCallback(async (schedule: any) => {
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

      console.log('📢 [Realtime] 报名状态更新，卡片已渲染:', {
        scheduleId: schedule.id,
        userName,
        date: schedule.date,
        timeSlotId: schedule.time_slot_id
      });
    }, []);

  // 处理 locked 状态
  const handleLockedStatus = useCallback(async (schedule: any) => {
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

      console.log('📢 [Realtime] 锁定状态更新，卡片已渲染:', {
        scheduleId: schedule.id,
        date: schedule.date,
        timeSlotId: schedule.time_slot_id,
        lockType: schedule.lock_type,
        lockReason: schedule.lock_reason
      });
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

  // 使用 ref 来存储当前的锁定状态，避免依赖项变化导致意外的清理
  const currentUserLocksRef = useRef<Set<string>>(new Set());
  
  // 更新 ref 的值
  useEffect(() => {
    currentUserLocksRef.current = currentUserLocks;
  }, [currentUserLocks]);

  // 页面卸载时释放所有锁定
  useEffect(() => {
    return () => {
      // 只在组件真正卸载时释放锁定
      console.log('🗑️ [Cleanup] 组件卸载，释放所有编辑锁定:', Array.from(currentUserLocksRef.current));
      currentUserLocksRef.current.forEach(scheduleId => {
        releaseEditLock(scheduleId);
      });
    };
  }, []); // 空依赖数组，只在组件挂载/卸载时执行

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