import { supabase } from '../supaClient';
import { withRetry, supabaseRetryOptions } from '../utils/retryUtils';

export interface Notification {
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

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
  target_roles?: string[];
  target_organizations?: string[];
  is_active: boolean;
  start_time: string;
  end_time?: string;
  created_by?: number;
  created_at: string;
  is_read?: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  handled: number;
}

export interface NotificationResponse {
  data: Notification[];
  total: number;
  hasMore: boolean;
}

// 缓存管理
class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  clearByPattern(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

class NotificationApi {
  private baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-system`;
  private cache = new CacheManager();

  private async request(endpoint: string, options: RequestInit = {}) {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // 静默处理未登录状态，返回空数据而不是抛出错误
        console.log('用户未登录，跳过通知请求');
        return { data: [], total: 0 };
      }

      const response = await fetch(`${this.baseUrl}?action=${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        // 对于401错误，静默处理而不是抛出异常
        if (response.status === 401) {
          console.log('认证失败，跳过通知请求');
          return { data: [], total: 0 };
        }
        
        const error = await response.json(); 
        throw new Error(error.error || error.details || '请求失败');
      }

      return response.json();
    }, supabaseRetryOptions);
  }

  // 获取用户通知 - 添加缓存和分页
  async getNotifications(params?: {
    status?: string;
    limit?: number;
    offset?: number;
    useCache?: boolean;
  }): Promise<NotificationResponse> {
    const { status, limit = 50, offset = 0, useCache = true } = params || {};
    
    // 构建缓存键
    const cacheKey = `notifications_${status || 'all'}_${limit}_${offset}`;
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const searchParams = new URLSearchParams();
    if (status) searchParams.append('status', status);
    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());

    const response = await this.request(`notifications${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    const result = {
      data: response.data || [],
      total: response.total || 0,
      hasMore: (response.data || []).length === limit
    };

    // 缓存结果（5分钟）
    this.cache.set(cacheKey, result, 5 * 60 * 1000);
    
    return result;
  }

  // 获取用户公告 - 添加缓存
  async getAnnouncements(params?: {
    unread_only?: boolean;
    useCache?: boolean;
  }): Promise<Announcement[]> {
    const { unread_only, useCache = true } = params || {};
    
    // 构建缓存键
    const cacheKey = `announcements_${unread_only ? 'unread' : 'all'}`;
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const searchParams = new URLSearchParams();
    if (unread_only) searchParams.append('unread_only', 'true');

    const response = await this.request(`announcements${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    const result = response.data || [];

    // 缓存结果（10分钟）
    this.cache.set(cacheKey, result, 10 * 60 * 1000);
    
    return result;
  }

  // 获取所有公告（管理员功能） - 添加缓存
  async getAllAnnouncements(params?: {
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    offset?: number;
    useCache?: boolean;
  }): Promise<Announcement[]> {
    const { status, limit, offset, useCache = true } = params || {};
    
    // 构建缓存键
    const cacheKey = `all_announcements_${status || 'all'}_${limit || 50}_${offset || 0}`;
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const searchParams = new URLSearchParams();
    if (status) searchParams.append('status', status);
    if (limit) searchParams.append('limit', limit.toString());
    if (offset) searchParams.append('offset', offset.toString());

    const response = await this.request(`all_announcements${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    const result = response.data || [];

    // 缓存结果（5分钟）
    this.cache.set(cacheKey, result, 5 * 60 * 1000);
    
    return result;
  }

  // 获取通知统计 - 添加缓存
  async getNotificationStats(useCache: boolean = true): Promise<NotificationStats> {
    const cacheKey = 'notification_stats';
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await this.request('stats');
    const result = response.data || { total: 0, unread: 0, read: 0, handled: 0 };

    // 缓存结果（2分钟）
    this.cache.set(cacheKey, result, 2 * 60 * 1000);
    
    return result;
  }

  // 创建通知 - 清除相关缓存
  async createNotification(data: {
    target_user_id: number;
    type: string;
    title: string;
    content?: string;
    metadata?: any;
    priority?: number;
  }): Promise<{ notification_id: string }> {
    const response = await this.request('create_notification', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
    
    return response.data;
  }

  // 创建公告 - 清除相关缓存
  async createAnnouncement(data: {
    title: string;
    content: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    priority?: number;
    target_roles?: string[];
    target_organizations?: string[];
    start_time?: string;
    end_time?: string;
  }): Promise<{ announcement_id: string }> {
    const response = await this.request('create_announcement', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('announcements');
    
    return response.data;
  }

  // 标记通知为已读 - 清除相关缓存
  async markNotificationRead(notificationId: string): Promise<void> {
    await this.request('mark_read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
  }

  // 标记通知为已处理 - 清除相关缓存
  async markNotificationHandled(notificationId: string): Promise<void> {
    await this.request('mark_handled', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
  }

  // 标记公告为已读 - 清除相关缓存
  async markAnnouncementRead(announcementId: string): Promise<void> {
    await this.request('mark_announcement_read', {
      method: 'POST',
      body: JSON.stringify({ announcement_id: announcementId }),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('announcements');
  }

  // 删除通知 - 清除相关缓存
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`delete_notification&id=${notificationId}`, {
      method: 'DELETE',
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
  }

  // 删除公告 - 清除相关缓存
  async deleteAnnouncement(announcementId: string): Promise<void> {
    console.log('notificationApi.deleteAnnouncement 开始，ID:', announcementId);
    
    try {
      console.log('发送删除请求，URL参数:', `delete_announcement&id=${announcementId}`);
      const response = await this.request(`delete_announcement&id=${announcementId}`, {
        method: 'DELETE',
      });
      
      console.log('deleteAnnouncement API 响应:', response);
      
      // 清除相关缓存
      this.cache.clearByPattern('announcements');
      console.log('公告删除成功，缓存已清除');
    } catch (error) {
      console.error('deleteAnnouncement API 错误:', error);
      throw error;
    }
  }

  // 更新公告 - 清除相关缓存
  async updateAnnouncement(data: {
    id: string;
    title?: string;
    content?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    priority?: number;
    target_roles?: string[];
    target_organizations?: string[];
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
  }): Promise<Announcement> {
    const response = await this.request('update_announcement', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('announcements');
    
    return response.data;
  }

  // 创建线索分配通知
  async createLeadAssignmentNotification(userId: number, leadId: string): Promise<void> {
    await this.createNotification({
      target_user_id: userId,
      type: 'lead_assignment',
      title: '新线索分配',
      content: `线索 ${leadId} 已分配给您`,
      priority: 1,
      metadata: { leadId, assignedAt: new Date().toISOString() }
    });
  }

  // 创建重复客户通知
  async createDuplicateCustomerNotification(userId: number, duplicateData: any): Promise<void> {
    await this.createNotification({
      target_user_id: userId,
      type: 'duplicate_customer',
      title: '重复客户提醒',
      content: `发现重复客户：${duplicateData.new_leadid} 与 ${duplicateData.original_leadid}`,
      priority: 2,
      metadata: duplicateData
    });
  }

  // 创建系统公告
  async createSystemAnnouncement(data: {
    title: string;
    content: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    priority?: number;
    target_roles?: string[];
    target_organizations?: string[];
  }): Promise<void> {
    await this.createAnnouncement({
      ...data,
      type: data.type || 'info',
      priority: data.priority || 0
    });
  }

  // 批量操作 - 新增功能
  async batchMarkAsRead(notificationIds: string[]): Promise<void> {
    await this.request('batch_mark_read', {
      method: 'POST',
      body: JSON.stringify({ notification_ids: notificationIds }),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
  }

  async batchDelete(notificationIds: string[]): Promise<void> {
    await this.request('batch_delete', {
      method: 'DELETE',
      body: JSON.stringify({ notification_ids: notificationIds }),
    });
    
    // 清除相关缓存
    this.cache.clearByPattern('notifications');
    this.cache.clearByPattern('notification_stats');
  }

  // 清除所有缓存
  clearCache(): void {
    this.cache.clear();
  }

  // 获取缓存统计
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache['cache'].size,
      keys: Array.from(this.cache['cache'].keys())
    };
  }
}

export const notificationApi = new NotificationApi(); 

 