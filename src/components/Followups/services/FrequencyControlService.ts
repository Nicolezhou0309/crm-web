import { supabase } from '../../../supaClient';

/**
 * 频率控制服务
 * 统一管理操作频率限制和冷却时间
 */
export class FrequencyControlService {
  private userId: number;
  private cache = new Map<string, { result: any; timestamp: number }>();
  private pendingChecks = new Set<string>();

  constructor(userId: number) {
    this.userId = userId;
  }

  /**
   * 检查操作频率
   */
  async checkFrequency(operationType: string = 'update'): Promise<{
    allowed: boolean;
    message?: string;
    cooldown_until?: string;
  }> {
    if (!this.userId || this.userId <= 0) {
      return { allowed: true };
    }

    const cacheKey = `frequency_check_${operationType}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    // 本地缓存10秒，避免频繁调用
    if (cached && now - cached.timestamp < 10000) {
      return cached.result;
    }

    // 防重复调用：如果已有相同请求在进行中，等待结果
    if (this.pendingChecks.has(cacheKey)) {
      // 等待最多3秒
      let waitTime = 0;
      while (this.pendingChecks.has(cacheKey) && waitTime < 3000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }

      // 如果等待后缓存已更新，直接返回
      const updatedCache = this.cache.get(cacheKey);
      if (updatedCache && now - updatedCache.timestamp < 10000) {
        return updatedCache.result;
      }
    }

    // 标记正在检查
    this.pendingChecks.add(cacheKey);

    try {
      const { data, error } = await supabase.rpc('check_operation_frequency', {
        p_user_id: this.userId,
        p_operation_type: operationType,
      });

      if (error) {
        console.error('[FREQ] RPC 调用失败:', error);
        const result = { allowed: true };
        this.cache.set(cacheKey, { result, timestamp: now });
        return result;
      }

      const result = { 
        allowed: data.allowed, 
        message: data.message, 
        cooldown_until: data.cooldown_until 
      };
      this.cache.set(cacheKey, { result, timestamp: now });
      return result;

    } catch (error) {
      console.error('[FREQ] 异常捕获:', error);
      const result = { allowed: true };
      this.cache.set(cacheKey, { result, timestamp: now });
      return result;
    } finally {
      this.pendingChecks.delete(cacheKey);
    }
  }

  /**
   * 记录操作到频控系统
   */
  async recordOperation(
    operationType: string = 'update',
    recordId?: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    if (!this.userId || this.userId <= 0) {
      return;
    }

    // 防重复记录：相同操作5秒内不重复记录
    const recordKey = `${operationType}_${recordId}_${oldValue}_${newValue}`;
    const now = Date.now();
    const cached = this.cache.get(recordKey);

    if (cached && now - cached.timestamp < 5000) {
      return;
    }

    try {
      const { error } = await supabase.rpc('record_operation', {
        p_user_id: this.userId,
        p_operation_type: operationType,
        p_record_id: recordId,
        p_old_value: oldValue,
        p_new_value: newValue,
      });

      if (error) {
        console.error('[FREQ] recordOperation: RPC 调用失败，error:', error);
      } else {
        // 记录成功，更新缓存
        this.cache.set(recordKey, { result: { success: true }, timestamp: now });
      }
    } catch (error) {
      console.error('[FREQ] recordOperation: 异常捕获:', error);
    }
  }

  /**
   * 获取用户ID
   */
  getUserId(): number {
    return this.userId;
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 60000) { // 清理1分钟前的缓存
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus() {
    const now = Date.now();
    const status: Record<string, { age: number; valid: boolean }> = {};

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      status[key] = {
        age: Math.floor(age / 1000), // 转换为秒
        valid: age < 60000 // 1分钟内有效
      };
    }

    return status;
  }
}