// 头像日志管理工具
export class AvatarLogger {
  private static instance: AvatarLogger;
  private isEnabled: boolean = true;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private filters: string[] = [];

  static getInstance(): AvatarLogger {
    if (!AvatarLogger.instance) {
      AvatarLogger.instance = new AvatarLogger();
    }
    return AvatarLogger.instance;
  }

  // 启用/禁用日志
  enable(enabled: boolean = true) {
    this.isEnabled = enabled;
    console.log(`🔧 头像日志${enabled ? '已启用' : '已禁用'}`);
  }

  // 设置日志级别
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
    console.log(`🔧 头像日志级别设置为: ${level}`);
  }

  // 添加过滤器
  addFilter(filter: string) {
    if (!this.filters.includes(filter)) {
      this.filters.push(filter);
      console.log(`🔧 添加头像日志过滤器: ${filter}`);
    }
  }

  // 移除过滤器
  removeFilter(filter: string) {
    const index = this.filters.indexOf(filter);
    if (index > -1) {
      this.filters.splice(index, 1);
      console.log(`🔧 移除头像日志过滤器: ${filter}`);
    }
  }

  // 清空过滤器
  clearFilters() {
    this.filters = [];
    console.log('🔧 清空头像日志过滤器');
  }

  // 检查是否应该记录日志
  private shouldLog(level: string, component?: string): boolean {
    if (!this.isEnabled) return false;
    
    // 检查日志级别
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    if (messageLevelIndex < currentLevelIndex) return false;

    // 检查过滤器
    if (this.filters.length > 0) {
      const message = component || '';
      return this.filters.some(filter => message.includes(filter));
    }

    return true;
  }

  // 记录日志
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any, component?: string) {
    if (!this.shouldLog(level, component)) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
    }
  }

  // 便捷方法
  debug(message: string, data?: any, component?: string) {
    this.log('debug', message, data, component);
  }

  info(message: string, data?: any, component?: string) {
    this.log('info', message, data, component);
  }

  warn(message: string, data?: any, component?: string) {
    this.log('warn', message, data, component);
  }

  error(message: string, data?: any, component?: string) {
    this.log('error', message, data, component);
  }

  // 获取当前配置
  getConfig() {
    return {
      isEnabled: this.isEnabled,
      logLevel: this.logLevel,
      filters: [...this.filters]
    };
  }

  // 导出日志配置
  exportConfig() {
    const config = this.getConfig();
    console.log('🔧 当前头像日志配置:', config);
    return config;
  }
}

// 默认实例
export const avatarLogger = AvatarLogger.getInstance();

// 全局头像日志控制函数
export const setupAvatarLogging = () => {
  // 将日志控制函数暴露到全局，方便调试
  (window as any).avatarLogger = avatarLogger;
  
  console.log(`
🔧 头像日志控制工具已加载！

使用方法：
- avatarLogger.enable(true/false)           // 启用/禁用日志
- avatarLogger.setLogLevel('debug/info/warn/error')  // 设置日志级别
- avatarLogger.addFilter('UserContext')     // 添加过滤器
- avatarLogger.removeFilter('UserContext')  // 移除过滤器
- avatarLogger.clearFilters()               // 清空过滤器
- avatarLogger.exportConfig()               // 导出当前配置

示例：
- avatarLogger.addFilter('UserContext')     // 只显示UserContext相关日志
- avatarLogger.addFilter('useImageRetry')   // 只显示useImageRetry相关日志
- avatarLogger.setLogLevel('warn')          // 只显示警告和错误日志
  `);
};

// 自动设置
setupAvatarLogging();
