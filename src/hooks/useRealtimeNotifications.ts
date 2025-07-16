import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supaClient';
import { useAuth } from './useAuth';
import { notificationApi } from '../api/notificationApi';

interface Notification {
  id: string;
  user_id: number;
  type: string;
  title: string;
  content: string;
  metadata?: any;
  status: 'unread' | 'read' | 'handled';
  priority: number;
  expires_at?: string;
  created_at: string;
  read_at?: string;
  handled_at?: string;
}

// 防抖函数
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // 1. 获取profileId - 添加缓存
  useEffect(() => {
    if (!user) return;
    
    // 检查本地缓存
    const cachedProfileId = localStorage.getItem(`profileId_${user.id}`);
    if (cachedProfileId) {
      setProfileId(parseInt(cachedProfileId));
      return;
    }

    supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setProfileId(null);
        } else {
          const pid = data?.id || null;
          setProfileId(pid);
          // 缓存profileId
          if (pid) {
            localStorage.setItem(`profileId_${user.id}`, pid.toString());
          }
        }
      });
  }, [user]);

  // 2. 通知加载和订阅 - 优化实时订阅
  useEffect(() => {
    if (!profileId) return;
    
    // 1. 初始加载通知
    loadNotifications(profileId);
    
    // 2. 订阅实时通知 - 优化订阅逻辑
    const channel = supabase
      .channel(`public:notifications`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`
      }, (payload) => {
        const newNotification = payload.new as Notification;
        
        // 使用函数式更新，避免闭包问题
        setNotifications(prev => {
          // 检查是否已存在相同ID的通知
          const exists = prev.some(n => n.id === newNotification.id);
          if (exists) return prev;
          
          const newList = [newNotification, ...prev];
          return newList;
        });
        
        // 优化未读数量更新
        setUnreadCount(prev => {
          if (newNotification.status === 'unread') {
            const newCount = prev + 1;
            return newCount;
          }
          return prev;
        });
        
        setLastUpdate(Date.now());
        showDesktopNotification(newNotification.title, newNotification.content);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`
      }, (payload) => {
        const updatedNotification = payload.new as Notification;
        
        setNotifications(prev => 
          prev.map(n => 
            n.id === updatedNotification.id ? updatedNotification : n
          )
        );
        
        // 防抖更新未读数量
        debouncedUpdateUnreadCount();
        setLastUpdate(Date.now());
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`
      }, (payload) => {
        setNotifications(prev => 
          prev.filter(n => n.id !== payload.old.id)
        );
        debouncedUpdateUnreadCount();
        setLastUpdate(Date.now());
      })
      .subscribe((status) => { 
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // 防抖的未读数量更新
  const debouncedUpdateUnreadCount = useCallback(
    debounce(() => {
      updateUnreadCount();
    }, 300),
    []
  );

  // 加载通知 - 添加缓存和错误重试
  const loadNotifications = useCallback(async (pid: number) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_user_id: pid
      });
      
      if (error) {
        throw error;
      }
      
      setNotifications(data || []);
      updateUnreadCount(data || []);
      
      // 缓存通知数据
      localStorage.setItem(`notifications_${pid}`, JSON.stringify(data || []));
      localStorage.setItem(`notifications_timestamp_${pid}`, Date.now().toString());
      
    } catch (error) {
      
      // 尝试从缓存加载
      const cachedData = localStorage.getItem(`notifications_${pid}`);
      if (cachedData) {
        const cachedNotifications = JSON.parse(cachedData);
        setNotifications(cachedNotifications);
        updateUnreadCount(cachedNotifications);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 重新计算未读数 - 使用useMemo优化
  const updateUnreadCount = useCallback((list?: Notification[]) => {
    const arr = list || notifications;
    const count = arr.filter(n => n.status === 'unread').length;
    setUnreadCount(count);
  }, [notifications]);

  // 标记为已读 - 优化本地状态更新
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!profileId) return;
    
    // 立即更新本地状态，提升响应体验
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, status: 'read' as const, read_at: new Date().toISOString() }
          : n
      )
    );
    
    // 更新未读数量
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: profileId
      });
      
      if (error) {
        throw error;
      }
      
    } catch (error) {
      // 失败时回滚本地状态
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, status: 'unread' as const, read_at: undefined }
            : n
        )
      );
      setUnreadCount(prev => prev + 1);
    }
  }, [profileId]);

  // 标记为已处理 - 优化本地状态更新
  const markAsHandled = useCallback(async (notificationId: string) => { 
    if (!profileId) return;
    // 立即更新本地状态
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, status: 'handled' as const, handled_at: new Date().toISOString() }
          : n
      )
    );
    // 如果本地是未读，减少未读数
    const n = notifications.find(n => n.id === notificationId);
    if (n && n.status === 'unread') {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    try {
      const { error } = await supabase.rpc('mark_notification_handled', {
        p_notification_id: notificationId,
        p_user_id: profileId
      });
      if (error) throw error;
    } catch (error) {
      // 失败时回滚本地状态
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, status: 'read' as const, handled_at: undefined }
            : n
        )
      );
    }
  }, [profileId, notifications]);

  // 删除通知 - 优化本地状态更新
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!profileId) return;
    
    // 先本地移除
    const prevList = notifications;
    const notificationToDelete = notifications.find(n => n.id === notificationId);
    const wasUnread = notificationToDelete?.status === 'unread';
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // 如果是未读通知，更新未读数量
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    try {
      await notificationApi.deleteNotification(notificationId);
    } catch (error) {
      // 失败回滚
      setNotifications(prevList);
      if (wasUnread) {
        setUnreadCount(prev => prev + 1);
      }
      throw error;
    }
  }, [notifications, profileId]);

  // 桌面通知
  const showDesktopNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/badge.png'
      });
    }
  }, []);

  // 使用useMemo优化计算属性
  const notificationStats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter(n => n.status === 'unread').length;
    const read = notifications.filter(n => n.status === 'read').length;
    const handled = notifications.filter(n => n.status === 'handled').length;
    
    return { total, unread, read, handled };
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAsHandled,
    deleteNotification,
    loadNotifications,
    loading,
    lastUpdate,
    notificationStats,
  };
}; 