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

  constructor() {
    this.config = {
      enabled: true, // 代理服务器支持WebSocket，启用realtime
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000
    };

    console.log('🔧 [RealtimeService] 初始化配置:', {
      enabled: this.config.enabled,
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      note: '代理服务器支持WebSocket，启用realtime功能'
    });
  }

  /**
   * 订阅数据库变化
   */
  subscribe(subscription: Omit<RealtimeSubscription, 'id' | 'channel'>): string {
    if (!this.config.enabled) {
      console.log('⚠️ [RealtimeService] Realtime已禁用，跳过订阅:', subscription.table);
      return '';
    }

    const id = `${subscription.table}-${subscription.event}-${Date.now()}`;
    
    try {
      console.log('🔄 [RealtimeService] 创建订阅:', {
        id,
        table: subscription.table,
        event: subscription.event,
        filter: subscription.filter
      });

      const channel = supabase
        .channel(id)
        .on('postgres_changes', {
          event: subscription.event as any,
          schema: 'public',
          table: subscription.table,
          filter: subscription.filter
        }, (payload) => {
          console.log('📡 [RealtimeService] 收到事件:', {
            id,
            table: subscription.table,
            event: subscription.event,
            payload: payload
          });
          
          try {
            subscription.callback(payload);
          } catch (error) {
            console.error('❌ [RealtimeService] 回调执行失败:', error);
          }
        })
        .on('system', { event: 'disconnect' }, () => {
          console.log('🔌 [RealtimeService] 系统断开连接');
          this.isConnected = false;
          this.handleReconnect();
        })
        .on('system', { event: 'reconnect' }, () => {
          console.log('🔌 [RealtimeService] 系统重新连接');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        })
        .subscribe((status) => {
          console.log('📡 [RealtimeService] 订阅状态变化:', {
            id,
            status,
            is_subscribed: status === 'SUBSCRIBED'
          });

          if (status === 'SUBSCRIBED') {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [RealtimeService] 订阅失败:', id);
            this.isConnected = false;
            this.handleReconnect();
          }
        });

      this.subscriptions.set(id, {
        id,
        channel,
        ...subscription
      });

      return id;
    } catch (error) {
      console.error('❌ [RealtimeService] 创建订阅失败:', error);
      return '';
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      console.log('🔌 [RealtimeService] 取消订阅:', id);
      try {
        supabase.removeChannel(subscription.channel);
        this.subscriptions.delete(id);
      } catch (error) {
        console.error('❌ [RealtimeService] 取消订阅失败:', error);
      }
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    console.log('🔌 [RealtimeService] 取消所有订阅');
    this.subscriptions.forEach((subscription, id) => {
      this.unsubscribe(id);
    });
    this.stopHeartbeat();
  }

  /**
   * 处理重连
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ [RealtimeService] 达到最大重连次数，停止重连');
      message.error('实时连接已断开，请刷新页面重试');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [RealtimeService] 尝试重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

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
        console.log('💓 [RealtimeService] 心跳检测失败，尝试重连');
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
    console.log('🔧 [RealtimeService] 配置已更新:', this.config);
  }
}

// 创建单例实例
export const realtimeService = new RealtimeService();

// 导出类型和实例
export default realtimeService;
