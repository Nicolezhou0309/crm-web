/**
 * 统一的Realtime服务管理器
 * 整合所有realtime功能，避免重复连接和混合内容问题
 */

import { supabase } from '../supaClient';
import { message } from 'antd';

export interface RealtimeSubscription {
  id: string;
  channel: any;
  table: string;
  event: string;
  filter?: string;
  callback: (payload: any) => void;
}

export interface RealtimeConfig {
  enabled: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}

class RealtimeService {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private config: RealtimeConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sharedChannel: any = null; // 共享的WebSocket连接
  private connectionCount: number = 0; // 连接计数器

  constructor() {
    // 检查环境配置，允许在HTTP环境下使用realtime（用于本地开发）
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const isSecureUrl = supabaseUrl && supabaseUrl.startsWith('https://');
    const isLocalDevelopment = supabaseUrl && (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('47.123.26.25'));
    
    this.config = {
      enabled: isHttps && isSecureUrl || isLocalDevelopment, // 在HTTPS环境或本地开发环境下启用realtime
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000
    };
    
    console.log('🔧 [RealtimeService] 配置信息:', {
      isHttps,
      isSecureUrl,
      isLocalDevelopment,
      supabaseUrl,
      enabled: this.config.enabled
    });
  }

  /**
   * 订阅数据库变化 - 使用共享连接优化
   */
  subscribe(subscription: Omit<RealtimeSubscription, 'id' | 'channel'>): string {
    if (!this.config.enabled) {
      return '';
    }

    const id = `${subscription.table}-${subscription.event}-${Date.now()}`;
    
    try {
      // 使用共享连接，避免创建多个WebSocket连接
      if (!this.sharedChannel) {
        this.createSharedChannel();
      }

      // 在共享连接上添加新的监听器
      this.sharedChannel.on('postgres_changes', {
        event: subscription.event as any,
        schema: 'public',
        table: subscription.table,
        filter: subscription.filter
      }, (payload: any) => {
        try {
          subscription.callback(payload);
        } catch (error) {
          console.error('❌ [RealtimeService] 回调执行失败:', error);
        }
      });

      this.subscriptions.set(id, {
        id,
        channel: this.sharedChannel, // 使用共享连接
        ...subscription
      });

      this.connectionCount++;
      console.log(`🔗 [RealtimeService] 新增订阅: ${id}, 当前连接数: ${this.connectionCount}`);

      return id;
    } catch (error) {
      console.error('❌ [RealtimeService] 创建订阅失败:', error);
      return '';
    }
  }

  /**
   * 创建共享的WebSocket连接
   */
  private createSharedChannel(): void {
    const channelId = `shared-realtime-${Date.now()}`;
    
    this.sharedChannel = supabase
      .channel(channelId)
      .on('system', { event: 'disconnect' }, () => {
        console.log('🔌 [RealtimeService] 共享连接断开');
        this.isConnected = false;
        this.handleReconnect();
      })
      .on('system', { event: 'reconnect' }, () => {
        console.log('🔌 [RealtimeService] 共享连接重连');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      })
      .subscribe((status) => {
        console.log(`🔗 [RealtimeService] 共享连接状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        } else if (status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          this.handleReconnect();
        }
      });

    console.log('🔗 [RealtimeService] 创建共享WebSocket连接');
  }

  /**
   * 取消订阅
   */
  unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      try {
        // 由于使用共享连接，不需要移除整个channel
        // 只需要从订阅列表中移除
        this.subscriptions.delete(id);
        this.connectionCount--;
        console.log(`🔗 [RealtimeService] 移除订阅: ${id}, 当前连接数: ${this.connectionCount}`);
        
        // 如果没有订阅了，关闭共享连接
        if (this.connectionCount === 0 && this.sharedChannel) {
          supabase.removeChannel(this.sharedChannel);
          this.sharedChannel = null;
          console.log('🔗 [RealtimeService] 关闭共享WebSocket连接');
        }
      } catch (error) {
        console.error('❌ [RealtimeService] 取消订阅失败:', error);
      }
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
    this.connectionCount = 0;
    
    if (this.sharedChannel) {
      supabase.removeChannel(this.sharedChannel);
      this.sharedChannel = null;
      console.log('🔗 [RealtimeService] 关闭所有连接');
    }
    
    this.stopHeartbeat();
  }

  /**
   * 处理重连
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      message.error('实时连接已断开，请刷新页面重试');
      return;
    }

    this.reconnectAttempts++;

    setTimeout(() => {
      this.reconnectAll();
    }, this.config.reconnectDelay);
  }

  /**
   * 重连所有订阅
   */
  private reconnectAll(): void {
    const subscriptions = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    subscriptions.forEach(subscription => {
      const { id, ...config } = subscription;
      this.subscribe(config);
    });
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) {
        this.handleReconnect();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 获取订阅数量
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * 获取连接数量
   */
  getConnectionCount(): number {
    return this.connectionCount;
  }

  /**
   * 获取连接状态信息
   */
  getConnectionInfo(): { 
    isConnected: boolean; 
    subscriptionCount: number; 
    connectionCount: number;
    hasSharedChannel: boolean;
  } {
    return {
      isConnected: this.isConnected,
      subscriptionCount: this.subscriptions.size,
      connectionCount: this.connectionCount,
      hasSharedChannel: !!this.sharedChannel
    };
  }

  /**
   * 获取配置信息
   */
  getConfig(): RealtimeConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建单例实例
export const realtimeService = new RealtimeService();

// 导出类型和实例
export default realtimeService;
