import { FollowupService } from './FollowupService';
import { ContractDealsService } from './ContractDealsService';
import { EnumDataService } from './EnumDataService';
import { FrequencyControlService } from './FrequencyControlService';

/**
 * 服务管理器
 * 统一管理所有服务的实例和生命周期
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, any> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * 初始化服务管理器
   */
  async initialize(userId?: number) {
    if (this.initialized) {
      return;
    }

    try {
      // 初始化基础服务
      this.services.set('followup', new FollowupService());
      this.services.set('contractDeals', new ContractDealsService());
      this.services.set('enumData', new EnumDataService());

      // 初始化需要用户ID的服务
      if (userId) {
        this.services.set('frequencyControl', new FrequencyControlService(userId));
      }

      this.initialized = true;
      console.log('[ServiceManager] 服务初始化完成');
    } catch (error) {
      console.error('[ServiceManager] 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取跟进服务
   */
  getFollowupService(): FollowupService {
    if (!this.services.has('followup')) {
      throw new Error('FollowupService 未初始化');
    }
    return this.services.get('followup');
  }

  /**
   * 获取签约记录服务
   */
  getContractDealsService(): ContractDealsService {
    if (!this.services.has('contractDeals')) {
      throw new Error('ContractDealsService 未初始化');
    }
    return this.services.get('contractDeals');
  }

  /**
   * 获取枚举数据服务
   */
  getEnumDataService(): EnumDataService {
    if (!this.services.has('enumData')) {
      throw new Error('EnumDataService 未初始化');
    }
    return this.services.get('enumData');
  }

  /**
   * 获取频率控制服务
   */
  getFrequencyControlService(): FrequencyControlService | null {
    return this.services.get('frequencyControl') || null;
  }

  /**
   * 设置用户ID（用于频率控制服务）
   */
  setUserId(userId: number) {
    if (userId && userId > 0) {
      this.services.set('frequencyControl', new FrequencyControlService(userId));
    }
  }

  /**
   * 获取所有服务状态
   */
  getServicesStatus() {
    const status: Record<string, { initialized: boolean; type: string }> = {};
    
    for (const [name, service] of this.services.entries()) {
      status[name] = {
        initialized: !!service,
        type: service?.constructor?.name || 'Unknown'
      };
    }

    return status;
  }

  /**
   * 清理服务资源
   */
  cleanup() {
    // 清理频率控制服务的缓存
    const frequencyService = this.getFrequencyControlService();
    if (frequencyService) {
      frequencyService.clearExpiredCache();
    }

    // 清理枚举数据服务的缓存
    const enumService = this.getEnumDataService();
    if (enumService) {
      enumService.refreshAllCache();
    }

    console.log('[ServiceManager] 服务资源清理完成');
  }

  /**
   * 重置服务管理器
   */
  reset() {
    this.services.clear();
    this.initialized = false;
    console.log('[ServiceManager] 服务管理器已重置');
  }
}

/**
 * 便捷的服务访问函数
 */
export const getServiceManager = () => ServiceManager.getInstance();

export const getFollowupService = () => getServiceManager().getFollowupService();
export const getContractDealsService = () => getServiceManager().getContractDealsService();
export const getEnumDataService = () => getServiceManager().getEnumDataService();
export const getFrequencyControlService = () => getServiceManager().getFrequencyControlService();