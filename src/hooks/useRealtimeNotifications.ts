import { useEffect, useState } from 'react';
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

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. 获取profileId
  useEffect(() => {
    if (!user) return;
    console.log('🔍 查询users_profile，获取profileId...');
    supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ 获取profileId失败:', error);
          setProfileId(null);
        } else {
          console.log('✅ 获取profileId成功:', data?.id);
          setProfileId(data?.id || null);
        }
      });
  }, [user]);

  // 2. 通知加载和订阅
  useEffect(() => {
    if (!profileId) return;
    console.log('🔍 useRealtimeNotifications Hook 初始化');
    console.log('👤 当前用户:', user);
    console.log('👤 当前profileId:', profileId);
    // 1. 初始加载通知
    loadNotifications(profileId);
    // 2. 订阅实时通知
    console.log('📡 开始订阅实时通知...');
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`
      }, (payload) => {
        console.log('📨 收到新通知:', payload.new);
        const newNotification = payload.new as Notification;
        setNotifications(prev => {
          const newList = [newNotification, ...prev];
          console.log(`📋 通知列表更新: ${newList.length} 条`);
          return newList;
        });
        setUnreadCount(prev => {
          const newCount = prev + 1;
          console.log(`🔢 未读数量更新: ${prev} → ${newCount}`);
          return newCount;
        });
        showDesktopNotification(newNotification.title, newNotification.content);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profileId}`
      }, (payload) => {
        console.log('🔄 通知状态更新:', payload.new);
        setNotifications(prev => 
          prev.map(n => 
            n.id === payload.new.id ? payload.new as Notification : n
          )
        );
        updateUnreadCount();
      })
      .subscribe((status) => {
        console.log('📡 Realtime订阅状态:', status);
      });
    return () => {
      console.log('🧹 清理Realtime订阅');
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // 加载通知
  const loadNotifications = async (pid: number) => {
    setLoading(true);
    console.log('🔄 开始加载通知...');
    console.log(`👤 profileId: ${pid}`);
    try {
      console.log('📞 调用get_user_notifications函数...');
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_user_id: pid
      });
      if (error) {
        console.error('❌ 函数调用失败:', error);
        throw error;
      }
      console.log(`✅ 函数调用成功，返回 ${data?.length || 0} 条通知`);
      console.log('📋 通知数据:', data);
      setNotifications(data || []);
      updateUnreadCount(data || []);
    } catch (error) {
      console.error('❌ 加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重新计算未读数
  const updateUnreadCount = (list?: Notification[]) => {
    const arr = list || notifications;
    const count = arr.filter(n => n.status === 'unread').length;
    console.log(`🔢 计算未读数量: ${count} (总通知: ${arr.length})`);
    setUnreadCount(count);
  };

  // 标记为已读
  const markAsRead = async (notificationId: string) => {
    console.log(`📝 标记通知为已读: ${notificationId}`);
    if (!profileId) return;
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: profileId
      });
      if (error) {
        console.error('❌ 标记已读失败:', error);
        throw error;
      }
      console.log('✅ 标记已读成功');
    } catch (error) {
      console.error('❌ 标记已读失败:', error);
    }
  };

  // 标记为已处理
  const markAsHandled = async (notificationId: string) => {
    console.log(`✅ 标记通知为已处理: ${notificationId}`);
    if (!profileId) return;
    try {
      const { error } = await supabase.rpc('mark_notification_handled', {
        p_notification_id: notificationId,
        p_user_id: profileId
      });
      if (error) {
        console.error('❌ 标记已处理失败:', error);
        throw error;
      }
      console.log('✅ 标记已处理成功');
    } catch (error) {
      console.error('❌ 标记已处理失败:', error);
    }
  };

  // 删除通知
  const deleteNotification = async (notificationId: string) => {
    console.log(`🗑️ 删除通知: ${notificationId}`);
    if (!profileId) return;
    // 1. 先本地移除
    const prevList = notifications;
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    updateUnreadCount(notifications.filter(n => n.id !== notificationId));
    try {
      await notificationApi.deleteNotification(notificationId);
      console.log('✅ 删除通知成功');
    } catch (error) {
      // 失败回滚
      setNotifications(prevList);
      updateUnreadCount(prevList);
      console.error('❌ 删除通知失败:', error);
      throw error;
    }
  };

  const showDesktopNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/badge.png'
      });
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAsHandled,
    deleteNotification,
    loadNotifications,
    loading,
  };
}; 