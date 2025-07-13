import { supabase } from '../supaClient';

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

class NotificationApi {
  private baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-system`;

  private async request(endpoint: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('用户未登录');
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
      const error = await response.json();
      console.error('API错误详情:', error);
      throw new Error(error.error || error.details || '请求失败');
    }

    return response.json();
  }

  // 获取用户通知
  async getNotifications(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const response = await this.request(`notifications${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    return response.data || [];
  }

  // 获取用户公告
  async getAnnouncements(params?: {
    unread_only?: boolean;
  }): Promise<Announcement[]> {
    const searchParams = new URLSearchParams();
    if (params?.unread_only) searchParams.append('unread_only', 'true');

    const response = await this.request(`announcements${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    return response.data || [];
  }

  // 获取所有公告（管理员功能）
  async getAllAnnouncements(params?: {
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<Announcement[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const response = await this.request(`all_announcements${searchParams.toString() ? `&${searchParams.toString()}` : ''}`);
    return response.data || [];
  }

  // 获取通知统计
  async getNotificationStats(): Promise<NotificationStats> {
    const response = await this.request('stats');
    return response.data || { total: 0, unread: 0, read: 0, handled: 0 };
  }

  // 创建通知
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
    return response.data;
  }

  // 创建公告
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
    return response.data;
  }

  // 标记通知为已读
  async markNotificationRead(notificationId: string): Promise<void> {
    await this.request('mark_read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }

  // 标记通知为已处理
  async markNotificationHandled(notificationId: string): Promise<void> {
    await this.request('mark_handled', {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }

  // 标记公告为已读
  async markAnnouncementRead(announcementId: string): Promise<void> {
    await this.request('mark_announcement_read', {
      method: 'POST',
      body: JSON.stringify({ announcement_id: announcementId }),
    });
  }

  // 删除通知
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`delete_notification&id=${notificationId}`, {
      method: 'DELETE',
    });
  }

  // 删除公告
  async deleteAnnouncement(announcementId: string): Promise<void> {
    await this.request(`delete_announcement&id=${announcementId}`, {
      method: 'DELETE',
    });
  }

  // 更新公告
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
}

export const notificationApi = new NotificationApi(); 