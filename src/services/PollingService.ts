/**
 * 轮询服务 - 用于替代Supabase Realtime功能
 * 在HTTPS环境下，当WebSocket不可用时使用轮询方式获取数据更新
 */

interface PollingConfig {
  interval: number; // 轮询间隔（毫秒）
  maxRetries: number; // 最大重试次数
  retryDelay: number; // 重试延迟（毫秒）
}

interface PollingSubscription {
  id: string;
  table: string;
  filter?: any;
  callback: (data: any) => void;
  config: PollingConfig;
  isActive: boolean;
  lastData?: any;
  retryCount: number;
}

class PollingService {
  private subscriptions: Map<string, PollingSubscription> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // 统一使用轮询服务，不再检查HTTPS/HTTP分支
  }

  /**
   * 订阅数据变化（轮询方式）
   */
  subscribe(
    table: string,
    filter: any,
    callback: (data: any) => void,
    config: Partial<PollingConfig> = {}
  ): string {
    const subscriptionId = `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultConfig: PollingConfig = {
      interval: 5000, // 5秒轮询
      maxRetries: 3,
      retryDelay: 1000
    };

    const finalConfig = { ...defaultConfig, ...config };

    const subscription: PollingSubscription = {
      id: subscriptionId,
      table,
      filter,
      callback,
      config: finalConfig,
      isActive: true,
      retryCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);
    
    // 统一启动轮询，不再检查HTTPS/HTTP分支
    this.startPolling(subscriptionId);

    console.log(`🔄 [PollingService] 订阅创建: ${table}`, {
      subscriptionId,
      interval: finalConfig.interval,
      note: '统一使用轮询服务'
    });

    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      
      const timer = this.timers.get(subscriptionId);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(subscriptionId);
      }

      console.log(`🔄 [PollingService] 订阅取消: ${subscription.table}`, { subscriptionId });
    }
  }

  /**
   * 开始轮询
   */
  private startPolling(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.isActive) return;

    const poll = async () => {
      if (!subscription.isActive) return;

      try {
        // 这里应该调用实际的API获取数据
        // 由于我们禁用了realtime，这里使用模拟数据
        const newData = await this.fetchData(subscription.table, subscription.filter);
        
        // 检查数据是否有变化
        if (this.hasDataChanged(subscription.lastData, newData)) {
          subscription.lastData = newData;
          subscription.callback(newData);
          subscription.retryCount = 0; // 重置重试计数
        }
      } catch (error) {
        console.error(`🔄 [PollingService] 轮询错误: ${subscription.table}`, error);
        
        subscription.retryCount++;
        if (subscription.retryCount >= subscription.config.maxRetries) {
          console.error(`🔄 [PollingService] 达到最大重试次数，停止轮询: ${subscription.table}`);
          this.unsubscribe(subscriptionId);
          return;
        }

        // 延迟后重试
        setTimeout(() => {
          if (subscription.isActive) {
            this.startPolling(subscriptionId);
          }
        }, subscription.config.retryDelay);
      }
    };

    // 立即执行一次
    poll();

    // 设置定时器
    const timer = setInterval(poll, subscription.config.interval);
    this.timers.set(subscriptionId, timer);
  }

  /**
   * 获取数据（模拟实现）
   */
  private async fetchData(table: string, filter: any): Promise<any> {
    // 这里应该调用实际的Supabase API
    // 由于我们禁用了realtime，这里返回模拟数据
    return {
      table,
      filter,
      timestamp: Date.now(),
      data: `模拟数据 - ${table}`
    };
  }

  /**
   * 检查数据是否有变化
   */
  private hasDataChanged(oldData: any, newData: any): boolean {
    if (!oldData) return true;
    return JSON.stringify(oldData) !== JSON.stringify(newData);
  }

  /**
   * 清理所有订阅
   */
  cleanup(): void {
    this.subscriptions.forEach((_, subscriptionId) => {
      this.unsubscribe(subscriptionId);
    });
  }

  /**
   * 获取活跃订阅数量
   */
  getActiveSubscriptionsCount(): number {
    return this.subscriptions.size;
  }
}

// 单例实例
export const pollingService = new PollingService();

// 在页面卸载时清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pollingService.cleanup();
  });
}
