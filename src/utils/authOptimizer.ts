import { supabase } from '../supaClient';

interface TokenRefreshConfig {
  refreshThresholdMs: number; // token过期前多少毫秒开始刷新
  maxRetryAttempts: number;   // 最大重试次数
  retryDelayMs: number;       // 重试间隔
}

export class AuthOptimizer {
  private static instance: AuthOptimizer;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private lastRefreshTime = 0;
  private retryCount = 0;

  private config: TokenRefreshConfig = {
    refreshThresholdMs: 30 * 60 * 1000, // 30分钟
    maxRetryAttempts: 3,
    retryDelayMs: 5000, // 5秒
  };

  static getInstance(): AuthOptimizer {
    if (!AuthOptimizer.instance) {
      AuthOptimizer.instance = new AuthOptimizer();
    }
    return AuthOptimizer.instance;
  }

  // 智能token刷新
  async smartTokenRefresh(): Promise<{ success: boolean; refreshed?: boolean; error?: string }> {
    const now = Date.now();
    
    // 防止频繁刷新
    if (now - this.lastRefreshTime < 5 * 60 * 1000) {
      return { success: true, refreshed: false };
    }

    if (this.isRefreshing) {
      return { success: true, refreshed: false };
    }

    try {
      this.isRefreshing = true;
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (!session?.expires_at) {
        return { success: false, error: '无有效会话' };
      }

      const expiresAt = new Date(session.expires_at);
      const timeUntilExpiry = expiresAt.getTime() - now;

      // 如果token在配置的阈值内过期，主动刷新
      if (timeUntilExpiry <= this.config.refreshThresholdMs) {
        await supabase.auth.getSession(); // 触发刷新
        this.lastRefreshTime = now;
        this.retryCount = 0;
        return { success: true, refreshed: true };
      }

      return { success: true, refreshed: false };
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount < this.config.maxRetryAttempts) {
        // 延迟重试
        setTimeout(() => {
          this.smartTokenRefresh();
        }, this.config.retryDelayMs);
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '刷新失败' 
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  // 启动自动刷新
  startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // 每10分钟检查一次
    this.refreshTimer = setInterval(() => {
      this.smartTokenRefresh();
    }, 10 * 60 * 1000);
  }

  // 停止自动刷新
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<TokenRefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 获取当前状态
  getStatus() {
    return {
      isRefreshing: this.isRefreshing,
      lastRefreshTime: this.lastRefreshTime,
      retryCount: this.retryCount,
      config: this.config,
    };
  }

  // 重置状态
  reset(): void {
    this.isRefreshing = false;
    this.lastRefreshTime = 0;
    this.retryCount = 0;
    this.stopAutoRefresh();
  }
}

// 导出单例实例
export const authOptimizer = AuthOptimizer.getInstance();