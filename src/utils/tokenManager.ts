import { supabase } from '../supaClient';

// Token管理配置
interface TokenConfig {
  refreshThresholdMs: number; // token过期前多少毫秒开始刷新
  maxRetryAttempts: number;   // 最大重试次数
  retryDelayMs: number;       // 重试延迟
  checkIntervalMs: number;    // 检查间隔
}

// Token状态
interface TokenState {
  isRefreshing: boolean;
  lastRefreshTime: number;
  retryCount: number;
  lastActivityTime: number;
}

// 统一Token管理器
class TokenManager {
  private static instance: TokenManager;
  private state: TokenState;
  private config: TokenConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(event: string, session: any) => void> = new Set();
  private lastNotifyTime: number = 0;

  private constructor() {
    this.state = {
      isRefreshing: false,
      lastRefreshTime: 0,
      retryCount: 0,
      lastActivityTime: Date.now(),
    };

    this.config = {
      refreshThresholdMs: 5 * 60 * 1000, // 5分钟前开始刷新
      maxRetryAttempts: 3,
      retryDelayMs: 5000, // 5秒
      checkIntervalMs: 5 * 60 * 1000, // 5分钟检查间隔
    };
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  // 获取当前会话
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('获取会话失败:', error);
        return { session: null, error };
      }
      return { session, error: null };
    } catch (error) {
      console.error('获取会话异常:', error);
      return { session: null, error };
    }
  }

  // 获取当前用户
  async getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('获取用户失败:', error);
        return { user: null, error };
      }
      return { user, error: null };
    } catch (error) {
      console.error('获取用户异常:', error);
      return { user: null, error };
    }
  }

  // 密码登录
  async signInWithPassword(email: string, password: string) {
    try {
      console.log('开始密码登录:', email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('密码登录失败:', error);
        return { data: null, error };
      }
      console.log('密码登录成功:', data?.user?.id);
      
      // 登录成功后立即通知监听器
      if (data?.user) {
        this.notifyListeners('SIGNED_IN', { user: data.user });
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('密码登录异常:', error);
      return { data: null, error };
    }
  }


  // 验证OTP (用于邀请和密码重置)
  async verifyOtp(email: string, token: string, type: 'invite' | 'recovery' | 'signup' | 'magiclink' | 'email') {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });
      if (error) {
        console.error('验证OTP失败:', error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error('验证OTP异常:', error);
      return { data: null, error };
    }
  }

  // 设置会话 (用于邀请链接)
  async setSession(accessToken: string, refreshToken?: string) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      if (error) {
        console.error('设置会话失败:', error);
        return { data: null, error };
      }
      
      // 设置会话成功后，通知监听器用户已登录
      if (data?.user) {
        console.log('设置会话成功，通知监听器用户已登录:', data.user.email);
        this.notifyListeners('SIGNED_IN', { user: data.user });
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('设置会话异常:', error);
      return { data: null, error };
    }
  }

  // 更新用户信息
  async updateUser(updates: { email?: string; password?: string }) {
    try {
      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) {
        console.error('更新用户失败:', error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error('更新用户异常:', error);
      return { data: null, error };
    }
  }

  // 发送密码重置邮件
  async resetPasswordForEmail(email: string, redirectTo?: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        console.error('发送密码重置邮件失败:', error);
        return { error };
      }
      return { error: null };
    } catch (error) {
      console.error('发送密码重置邮件异常:', error);
      return { error };
    }
  }

  // 用户注册
  async signUp(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        console.error('用户注册失败:', error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error('用户注册异常:', error);
      return { data: null, error };
    }
  }

  // 检查token是否有效
  isTokenValid(token: string): boolean {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return false;
      }
      
      const payload = tokenParts[1];
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decodedPayload = atob(paddedPayload);
      const tokenData = JSON.parse(decodedPayload);
      
      const now = Math.floor(Date.now() / 1000);
      return tokenData.exp > now;
    } catch {
      return false;
    }
  }

  // 智能token刷新
  async smartTokenRefresh(): Promise<{ success: boolean; refreshed?: boolean; skipped?: boolean; error?: string }> {
    const now = Date.now();
    
    // 防止频繁刷新：至少间隔1分钟
    if (now - this.state.lastRefreshTime < 60 * 1000) {
      return { success: true, skipped: true };
    }

    if (this.state.isRefreshing) {
      return { success: true, skipped: true };
    }

    try {
      this.state.isRefreshing = true;
      
      const { session, error } = await this.getSession();
      
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
        console.log('Token即将过期，开始刷新...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw refreshError;
        }
        this.state.lastRefreshTime = now;
        this.state.retryCount = 0;
        console.log('Token刷新成功');
        return { success: true, refreshed: true };
      }

      return { success: true, skipped: true };
    } catch (error) {
      this.state.retryCount++;
      console.error('Token刷新失败:', error);
      
      // 如果重试次数过多，清除认证状态
      if (this.state.retryCount >= this.config.maxRetryAttempts) {
        console.error('Token刷新重试次数过多，执行登出');
        await this.logout();
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '刷新失败' 
      };
    } finally {
      this.state.isRefreshing = false;
    }
  }

  // 统一退出登录 - 清理所有本地缓存并跳转到登录页
  async logout(navigate?: any): Promise<void> {
    try {
      console.log('开始执行统一退出登录...');
      
      // 1. 清除所有本地存储的认证信息
      this.clearAllLocalStorage();
      
      // 2. 调用Supabase登出
      await supabase.auth.signOut();
      
      // 3. 重置TokenManager内部状态
      this.resetInternalState();
      
      // 4. 通知所有监听器用户已登出
      this.notifyListeners('SIGNED_OUT', null);
      
      // 5. 立即跳转到登录页面
      this.redirectToLogin(navigate);
      
      console.log('退出登录完成');
    } catch (error) {
      console.error('退出登录失败:', error);
      // 即使出错也要强制跳转到登录页
      this.redirectToLogin(navigate);
    }
  }

  // 清除所有本地存储
  private clearAllLocalStorage(): void {
    try {
      // 清除认证相关
      localStorage.removeItem('last_activity_timestamp');
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.expires_at');
      localStorage.removeItem('supabase.auth.refresh_token');
      localStorage.removeItem('supabase.auth.access_token');
      
      // 清除用户相关缓存
      localStorage.removeItem('user_profile');
      localStorage.removeItem('user_permissions');
      localStorage.removeItem('user_session');
      localStorage.removeItem('user_avatar_url');
      localStorage.removeItem('user_nickname');
      
      // 清除应用状态缓存
      localStorage.removeItem('app_notifications');
      localStorage.removeItem('app_theme');
      localStorage.removeItem('app_language');
      
      // 清除其他可能的缓存项
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('user') || 
          key.includes('auth') || 
          key.includes('session') || 
          key.includes('token') ||
          key.includes('profile') ||
          key.includes('permission')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('本地存储清理完成');
    } catch (error) {
      console.error('清除本地存储失败:', error);
    }
  }

  // 重置内部状态
  private resetInternalState(): void {
    this.state = {
      isRefreshing: false,
      lastRefreshTime: 0,
      retryCount: 0,
      lastActivityTime: 0,
    };
    
    // 停止自动刷新
    this.stopAutoRefresh();
    
    console.log('内部状态重置完成');
  }

  // 跳转到登录页面
  private redirectToLogin(navigate?: any): void {
    try {
      if (navigate && typeof navigate === 'function') {
        // 使用React Router导航，不刷新页面
        navigate('/login', { replace: true });
        console.log('使用React Router跳转到登录页');
      } else {
        // 使用页面刷新跳转
        window.location.href = '/login';
        console.log('使用页面刷新跳转到登录页');
      }
    } catch (error) {
      console.error('跳转到登录页失败:', error);
      // 最后的备选方案
      window.location.href = '/login';
    }
  }

  // 安全登出 - 保持向后兼容
  async safeSignOut(navigate?: any): Promise<void> {
    return this.logout(navigate);
  }

  // 更新活动时间
  updateActivity(): void {
    this.state.lastActivityTime = Date.now();
    localStorage.setItem('last_activity_timestamp', this.state.lastActivityTime.toString());
  }

  // 添加认证状态监听器
  addAuthStateListener(listener: (event: string, session: any) => void): () => void {
    this.listeners.add(listener);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 通知所有监听器
  private notifyListeners(event: string, session: any): void {
    // 添加防抖，避免频繁触发
    if (this.lastNotifyTime && Date.now() - this.lastNotifyTime < 1000) {
      return;
    }
    this.lastNotifyTime = Date.now();
    
    this.listeners.forEach(listener => {
      try {
        listener(event, session);
      } catch (error) {
        console.error('认证状态监听器执行失败:', error);
      }
    });
  }

  // 启动自动token监控
  startAutoRefresh(): () => void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // 启用自动token刷新
    this.refreshTimer = setInterval(async () => {
      try {
        const result = await this.smartTokenRefresh();
        if (result.refreshed) {
          console.log('自动Token刷新完成');
        }
      } catch (error) {
        console.error('自动Token刷新失败:', error);
      }
    }, this.config.checkIntervalMs);

    // 设置认证状态监听器，减少延迟以提高响应速度
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 减少延迟，提高登录响应速度
      setTimeout(() => {
        // 处理所有认证状态变化事件
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          this.notifyListeners(event, session);
        }
        
        // 更新活动时间
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          this.updateActivity();
        }
        
        // 处理token刷新事件
        if (event === 'TOKEN_REFRESHED') {
          console.log('收到Token刷新事件');
          this.state.lastRefreshTime = Date.now();
          this.state.retryCount = 0;
        }
      }, 10); // 减少延迟到10ms
    });

    // 设置活动监听器
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => this.updateActivity();
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // 返回清理函数
    return () => {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      subscription.unsubscribe();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }

  // 停止自动刷新
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // 获取当前状态
  getState(): TokenState {
    return { ...this.state };
  }

  // 获取配置
  getConfig(): TokenConfig {
    return { ...this.config };
  }

  // 获取token状态信息 - 用于调试
  async getTokenStatus(): Promise<{
    hasSession: boolean;
    expiresAt?: string;
    timeUntilExpiry?: number;
    isRefreshing: boolean;
    lastRefreshTime: number;
    retryCount: number;
  }> {
    try {
      const { session } = await this.getSession();
      
      if (!session?.expires_at) {
        return {
          hasSession: false,
          isRefreshing: this.state.isRefreshing,
          lastRefreshTime: this.state.lastRefreshTime,
          retryCount: this.state.retryCount,
        };
      }

      const expiresAt = new Date(session.expires_at);
      const timeUntilExpiry = expiresAt.getTime() - Date.now();

      return {
        hasSession: true,
        expiresAt: session.expires_at ? String(session.expires_at) : undefined,
        timeUntilExpiry,
        isRefreshing: this.state.isRefreshing,
        lastRefreshTime: this.state.lastRefreshTime,
        retryCount: this.state.retryCount,
      };
    } catch (error) {
      console.error('获取Token状态失败:', error);
      return {
        hasSession: false,
        isRefreshing: this.state.isRefreshing,
        lastRefreshTime: this.state.lastRefreshTime,
        retryCount: this.state.retryCount,
      };
    }
  }

  // 简化的认证状态检查 - 替代AuthErrorHandler的功能
  async checkAuthStatus(): Promise<{ isValid: boolean; user?: any; error?: string }> {
    try {
      const { session, error: sessionError } = await this.getSession();
      
      if (sessionError) {
        return { isValid: false, error: '无有效会话' };
      }

      if (!session) {
        return { isValid: false, error: '无有效会话' };
      }

      const { user, error: userError } = await this.getUser();
      
      if (userError) {
        return { isValid: false, error: '用户信息无效' };
      }

      if (!user) {
        return { isValid: false, error: '用户信息无效' };
      }

      return { isValid: true, user };
    } catch (error) {
      console.error('TokenManager: 认证状态检查异常', error);
      return { isValid: false, error: '认证检查异常' };
    }
  }

  // 确保token有效 - 用于API调用前检查
  async ensureValidToken(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.smartTokenRefresh();
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error) {
      console.error('确保Token有效失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token验证失败' 
      };
    }
  }

  // 安全的认证状态重置 - 替代AuthErrorHandler的safeSignOut调用
  async resetAuthState(): Promise<void> {
    try {
      // 清除本地存储
      localStorage.removeItem('last_activity_timestamp');
      localStorage.removeItem('supabase.auth.token');
      
      // 重置内部状态
      this.state.lastRefreshTime = 0;
      this.state.lastActivityTime = 0;
      this.state.retryCount = 0;
      
      // 通知监听器
      this.notifyListeners('SIGNED_OUT', null);
    } catch (error) {
      console.error('TokenManager: 重置认证状态失败', error);
    }
  }
}

// 导出单例实例
export const tokenManager = TokenManager.getInstance();

// 在开发环境下暴露到window对象，方便调试
if (process.env.NODE_ENV === 'development') {
  (window as any).tokenManager = tokenManager;
}

// 导出类型
export type { TokenConfig, TokenState };

// 添加测试方法到实例
(tokenManager as any).testLogout = async function(navigate?: any): Promise<void> {
  console.log('测试登出功能...');
  console.log('当前localStorage项目数量:', localStorage.length);
  
  // 列出所有localStorage项目
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      allKeys.push(key);
    }
  }
  console.log('当前localStorage项目:', allKeys);
  
  // 执行登出
  await this.logout(navigate);
};

// 添加token状态测试方法
(tokenManager as any).testTokenStatus = async function(): Promise<void> {
  console.log('测试Token状态...');
  const status = await this.getTokenStatus();
  console.log('Token状态:', status);
  
  const config = this.getConfig();
  console.log('Token配置:', config);
  
  const state = this.getState();
  console.log('Token状态:', state);
};

// 添加手动token刷新测试方法
(tokenManager as any).testTokenRefresh = async function(): Promise<void> {
  console.log('测试手动Token刷新...');
  const result = await this.smartTokenRefresh();
  console.log('Token刷新结果:', result);
};

/*
使用示例：

1. 在API调用前确保token有效：
```typescript
import { tokenManager } from './utils/tokenManager';

async function makeApiCall() {
  // 确保token有效
  const { success, error } = await tokenManager.ensureValidToken();
  if (!success) {
    console.error('Token无效:', error);
    return;
  }
  
  // 执行API调用
  const response = await fetch('/api/data');
  // ...
}
```

2. 检查token状态：
```typescript
const status = await tokenManager.getTokenStatus();
console.log('Token过期时间:', status.expiresAt);
console.log('距离过期还有:', status.timeUntilExpiry, '毫秒');
```

3. 测试token刷新：
```typescript
// 在浏览器控制台中
await (window as any).tokenManager.testTokenStatus();
await (window as any).tokenManager.testTokenRefresh();
```

4. 自动刷新配置：
- refreshThresholdMs: 5分钟前开始刷新
- checkIntervalMs: 每5分钟检查一次
- maxRetryAttempts: 最多重试3次
- retryDelayMs: 重试间隔5秒
*/