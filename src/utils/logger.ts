// 生产环境日志工具
// 确保在生产环境中也能看到调试信息

interface LogLevel {
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  private level: number;
  private isProduction: boolean;

  constructor() {
    // 在生产环境中也显示日志
    this.isProduction = import.meta.env.PROD;
    // 设置日志级别，生产环境显示所有级别
    this.level = this.isProduction ? LOG_LEVELS.DEBUG : LOG_LEVELS.DEBUG;
  }

  private shouldLog(level: number): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  // 专门用于企业微信登录的日志
  wecom(message: string, ...args: any[]): void {
    this.info(`[企业微信] ${message}`, ...args);
  }

  // 专门用于API调用的日志
  api(message: string, ...args: any[]): void {
    this.info(`[API] ${message}`, ...args);
  }

  // 专门用于二维码生成的日志
  qr(message: string, ...args: any[]): void {
    this.info(`[二维码] ${message}`, ...args);
  }
}

// 创建全局logger实例
export const logger = new Logger();

// 导出默认logger
export default logger;