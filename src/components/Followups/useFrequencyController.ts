import { useState, useEffect } from 'react';
import { supabase } from '../../supaClient';

export class FrequencyController {
  private userId: number;
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  private pendingChecks: Set<string> = new Set();
  
  constructor(userId: number) {
    this.userId = userId;
  }
  
  public getUserId() {
    return this.userId;
  }
  
  async checkFrequency(): Promise<{ allowed: boolean; message?: string; cooldown_until?: string }> {
    if (!this.userId || this.userId <= 0) {
      return { allowed: true };
    }
    
    const cacheKey = 'frequency_check';
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
        p_operation_type: 'update',
      });
      
      if (error) {
        console.error('[FREQ] RPC 调用失败:', error);
        const result = { allowed: true };
        this.cache.set(cacheKey, { result, timestamp: now });
        return result;
      }
      
      const result = { allowed: data.allowed, message: data.message, cooldown_until: data.cooldown_until };
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
  
  async recordOperation(recordId?: string, oldValue?: string, newValue?: string): Promise<void> {
    if (!this.userId || this.userId <= 0) {
      return;
    }
    
    // 防重复记录：相同操作5秒内不重复记录
    const recordKey = `${recordId}_${oldValue}_${newValue}`;
    const now = Date.now();
    const cached = this.cache.get(recordKey);
    
    if (cached && now - cached.timestamp < 5000) {
      return;
    }
    
    try {
      const { error } = await supabase.rpc('record_operation', {
        p_user_id: this.userId,
        p_operation_type: 'update',
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
  
  // 清理过期缓存
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 60000) { // 清理1分钟前的缓存
        this.cache.delete(key);
      }
    }
  }
}

export function useFrequencyController() {
  const [frequencyController, setFrequencyController] = useState<FrequencyController | null>(null);

  useEffect(() => {
    const init = async () => {
      // 注意：这个函数在Hook层面，但无法直接使用useUser Hook
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('users_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (!profileError && profileData && profileData.id) {
          const controller = new FrequencyController(profileData.id);
          setFrequencyController(controller);
          
          // 定期清理过期缓存
          const cleanupInterval = setInterval(() => {
            controller.clearExpiredCache();
          }, 60000); // 每分钟清理一次
          
          return () => clearInterval(cleanupInterval);
        } else {
          setFrequencyController(null);
        }
      } else {
        setFrequencyController(null);
      }
    };
    init();
  }, []);

  return frequencyController;
} 