import { BaseDataService } from './BaseDataService';
import type { Deal } from '../followupTypes';

/**
 * 签约记录服务
 * 提供签约相关的业务逻辑和数据访问
 */
export class ContractDealsService extends BaseDataService {
  constructor() {
    super('contract_deals');
  }

  /**
   * 获取签约记录列表
   */
  async getContractDeals(leadid: string) {
    try {
      const { data, error } = await this.query('*', { leadid });
      return { data: data as Deal[], error };
    } catch (error) {
      console.error('[ContractDealsService] 获取签约记录失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 创建签约记录
   */
  async createContractDeal(dealData: Partial<Deal>) {
    try {
      const { data, error } = await this.create(dealData);
      return { data: data as Deal, error };
    } catch (error) {
      console.error('[ContractDealsService] 创建签约记录失败:', error);
      return { data: null, error };
    }
  }

  /**
   * 更新签约记录
   */
  async updateContractDeal(id: string, updates: Partial<Deal>) {
    try {
      const { data, error } = await this.update(id, updates);
      return { data: data as Deal, error };
    } catch (error) {
      console.error('[ContractDealsService] 更新签约记录失败:', error);
      return { data: null, error };
    }
  }

  /**
   * 删除签约记录
   */
  async deleteContractDeal(id: string) {
    try {
      const { success, error } = await this.delete(id);
      return { success, error };
    } catch (error) {
      console.error('[ContractDealsService] 删除签约记录失败:', error);
      return { success: false, error };
    }
  }

  /**
   * 批量更新签约记录
   */
  async batchUpdateContractDeals(updates: Array<{ id: string; updates: Partial<Deal> }>) {
    try {
      const results = await Promise.all(
        updates.map(async ({ id, updates }) => {
          return await this.update(id, updates);
        })
      );

      const successCount = results.filter(r => !r.error).length;
      const errors = results.filter(r => r.error).map(r => r.error);

      return {
        successCount,
        totalCount: updates.length,
        errors,
        success: successCount === updates.length
      };
    } catch (error) {
      console.error('[ContractDealsService] 批量更新失败:', error);
      return {
        successCount: 0,
        totalCount: updates.length,
        errors: [error],
        success: false
      };
    }
  }

  /**
   * 获取签约统计信息
   */
  async getContractStats(leadid?: string) {
    try {
      const filters = leadid ? { leadid } : {};
      const { count: total } = await this.count(filters);
      
      // 获取各社区签约统计
      const { data: communityStats } = await this.query('community, count', filters);
      
      // 获取今日签约
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await this.count({
        ...filters,
        created_at: today.toISOString()
      });

      return {
        total: total || 0,
        todayCount: todayCount || 0,
        communityStats: communityStats || [],
        error: null
      };
    } catch (error) {
      console.error('[ContractDealsService] 获取统计信息失败:', error);
      return {
        total: 0,
        todayCount: 0,
        communityStats: [],
        error
      };
    }
  }
}