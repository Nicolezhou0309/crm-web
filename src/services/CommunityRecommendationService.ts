import { supabase } from '../supaClient';
import MetroCommuteService from './MetroCommuteService';

export interface RecommendationParams {
  worklocation: string;
  userbudget: number;
  customerprofile: string;
  followupId?: number;
}

export interface RecommendationParamsWithCommuteTimes extends RecommendationParams {
  commuteTimes: Record<string, number>;
}

export interface CommunityRecommendation {
  community: string;
  metrostation: string;
  lowest_price: number;
  highest_price: number;
  conversion_rates: any;
  score: number;
  commuteTime: number;
  commuteScore: number;
  budgetScore: number;
  historicalScore: number;
  reason: string;
  recommendation: string;
  color: string;
}

export class CommunityRecommendationService {
  private static instance: CommunityRecommendationService;
  
  // 本地缓存社区基础数据
  private static communityDataCache: any[] = [];
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天缓存

  public static getInstance(): CommunityRecommendationService {
    if (!CommunityRecommendationService.instance) {
      CommunityRecommendationService.instance = new CommunityRecommendationService();
    }
    return CommunityRecommendationService.instance;
  }

  /**
   * 获取社区推荐（使用数据库中的通勤时间）
   */
  async getRecommendations(params: RecommendationParams): Promise<CommunityRecommendation[]> {
    try {
      // 如果提供了followupId，先尝试从数据库获取缓存的推荐
      if (params.followupId) {
        const cachedRecommendations = await this.getCachedRecommendations(params.followupId);
        if (cachedRecommendations.length > 0) {
          return cachedRecommendations;
        }
      }

      // 从前端计算推荐（实时计算）
      const recommendations = await this.calculateRecommendationsFrontend(params);
      
      // 如果提供了followupId，缓存结果到数据库
      if (params.followupId) {
        await this.cacheRecommendations(params.followupId, recommendations);
      }

      return recommendations;
    } catch (error) {
      console.error('社区推荐服务错误:', error);
      return [];
    }
  }

  /**
   * 前端计算推荐（实时计算）
   */
  private async calculateRecommendationsFrontend(params: RecommendationParams): Promise<CommunityRecommendation[]> {
    try {
      // 1. 获取社区基础数据（使用本地缓存）
      const communities = await this.getCommunityDataWithCache();

      if (!communities || communities.length === 0) {
        return [];
      }

      // 2. 计算每个社区的推荐分数
      const recommendations: CommunityRecommendation[] = [];
      
      for (const community of communities) {
        const score = await this.calculateCommunityScore(community, params);
        if (score.totalScore > 0) {
          recommendations.push({
            community: community.community,
            score: score.totalScore,
            commuteTime: score.commuteTime,
            commuteScore: score.commuteScore,
            budgetScore: score.budgetScore,
            historicalScore: score.historicalScore,
            recommendation: this.getRecommendationLevel(score.totalScore).recommendation,
            reason: this.buildRecommendationReason(community, score),
            color: this.getRecommendationLevel(score.totalScore).color,
            metrostation: community.metrostation || '',
            lowest_price: community.lowest_price || 0,
            highest_price: community.highest_price || 0,
            conversion_rates: community.conversion_rates || {}
          });
        }
      }

      // 3. 按分数排序
      return recommendations.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('前端计算推荐失败:', error);
      return [];
    }
  }

  /**
   * 获取社区基础数据（带本地缓存）
   */
  private async getCommunityDataWithCache(): Promise<any[]> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (CommunityRecommendationService.communityDataCache.length > 0 && 
        (now - CommunityRecommendationService.cacheTimestamp) < CommunityRecommendationService.CACHE_DURATION) {
      return CommunityRecommendationService.communityDataCache;
    }

    try {
      
      // 从数据库获取社区基础数据
      const { data: communities, error } = await supabase
        .from('community_keywords')
        .select('community, metrostation, lowest_price, highest_price, conversion_rates')
        .not('metrostation', 'is', null)
        .not('lowest_price', 'is', null)
        .not('highest_price', 'is', null);

      if (error) {
        console.error('获取社区数据失败:', error);
        return [];
      }

      // 更新本地缓存
      CommunityRecommendationService.communityDataCache = communities || [];
      CommunityRecommendationService.cacheTimestamp = now;
      
      return communities || [];
    } catch (error) {
      console.error('获取社区数据失败:', error);
      return [];
    }
  }

  private async calculateCommunityScore(community: any, params: RecommendationParams) {
    // 使用数据库中的通勤时间
    let commuteTime: number;
    if (params.followupId) {
      commuteTime = await this.getCommuteTime(params.followupId, params.worklocation, community.community);
    } else {
      // 如果没有followupId，使用默认值
      commuteTime = 50; // 默认通勤时间
    }
    
    const commuteScore = this.getCommuteScore(commuteTime);
    
    const budgetScore = this.getBudgetScore(params.userbudget, community.lowest_price, community.highest_price);
    
    const conversionRate = this.getConversionRate(community.conversion_rates, params.customerprofile);
    const historicalScore = this.getHistoricalScore(conversionRate);
    
    const totalScore = (commuteScore * 0.4) + (budgetScore * 0.4) + (historicalScore * 0.2);
    
    return {
      commuteTime,
      commuteScore,
      budgetScore,
      historicalScore,
      totalScore: Math.round(totalScore * 10) / 10
    };
  }

  private getCommuteScore(commuteTime: number): number {
    if (commuteTime <= 30) return 100;
    if (commuteTime <= 45) return 85;
    if (commuteTime <= 60) return 70;
    if (commuteTime <= 90) return 50;
    return 30;
  }

  private getBudgetScore(userBudget: number, lowestPrice: number, highestPrice: number): number {
    if (userBudget >= lowestPrice && userBudget <= highestPrice) {
      return 100;
    } else if (userBudget < lowestPrice) {
      if (userBudget >= lowestPrice * 0.7) {
        return 80;
      } else {
        return 60;
      }
    } else {
      if (userBudget <= highestPrice * 1.5) {
        return 80;
      } else {
        return 60;
      }
    }
  }

  private getConversionRate(conversionRates: any, customerProfile: string): number {
    if (!conversionRates || !customerProfile) return 0;
    return conversionRates[customerProfile] || 0;
  }

  private getHistoricalScore(conversionRate: number): number {
    if (conversionRate >= 60) return 100;
    if (conversionRate >= 45) return 80;
    if (conversionRate >= 30) return 60;
    if (conversionRate >= 20) return 40;
    return 20;
  }

  private buildRecommendationReason(community: any, score: any): string {
    const { community: communityName, metrostation } = community;
    const { commuteTime, commuteScore, budgetScore, historicalScore, totalScore } = score;
    
    let reason = `${communityName}社区推荐理由：`;
    
    // 通勤时间部分
    if (commuteTime >= 0) {
      if (commuteScore >= 85) {
        reason += `通勤时间优秀(${commuteTime}分钟)`;
      } else if (commuteScore >= 70) {
        reason += `通勤时间良好(${commuteTime}分钟)`;
      } else if (commuteScore >= 50) {
        reason += `通勤时间一般(${commuteTime}分钟)`;
      } else {
        reason += `通勤时间较长(${commuteTime}分钟)`;
      }
    } else {
      reason += `通勤时间未计算(默认50分)`;
    }
    
    // 预算匹配度部分
    if (budgetScore > 0) {
      reason += `，预算匹配度${budgetScore}分`;
    } else {
      reason += `，预算信息缺失(默认50分)`;
    }
    
    // 历史成交率部分
    if (historicalScore > 0) {
      reason += `，历史成交率${historicalScore}分`;
    } else {
      reason += `，历史数据缺失(默认50分)`;
    }
    
    reason += `，综合评分${totalScore}分`;
    
    return reason;
  }

  /**
   * 获取推荐等级和颜色
   */
  private getRecommendationLevel(score: number): { recommendation: string; color: string } {
    if (score >= 85) {
      return { recommendation: '强烈推荐', color: '#52c41a' };
    } else if (score >= 75) {
      return { recommendation: '推荐', color: '#1890ff' };
    } else if (score >= 65) {
      return { recommendation: '可考虑', color: '#fa8c16' };
    } else if (score >= 55) {
      return { recommendation: '谨慎推荐', color: '#fa541c' };
    } else {
      return { recommendation: '不推荐', color: '#f5222d' };
    }
  }

  /**
   * 使用传入的通勤时间数据计算推荐（与基础数据同步）
   */
  async getRecommendationsWithCommuteTimes(params: RecommendationParamsWithCommuteTimes): Promise<CommunityRecommendation[]> {
    try {
      
      // 获取社区基础数据
      const { data: communities, error } = await supabase
        .from('community_keywords')
        .select('community, metrostation, lowest_price, highest_price, conversion_rates')
        .not('metrostation', 'is', null);

      if (error) {
        console.error('获取社区数据失败:', error);
        return [];
      }

      if (!communities || communities.length === 0) {
        return [];
      }

      const recommendations: CommunityRecommendation[] = [];

      for (const community of communities) {
        try {
          // 使用传入的通勤时间数据，如果没有则默认为0
          const commuteTime = params.commuteTimes[community.community] || 0;

          // 计算通勤评分（如果没有通勤时间数据，通勤评分为50分；0分钟表示就在地铁站，给100分）
          const commuteScore = commuteTime >= 0 ? this.getCommuteScore(commuteTime) : 50;
          
          // 计算预算匹配评分（如果没有预算数据，预算评分为50分）
          const budgetScore = params.userbudget > 0 ? 
            this.getBudgetScore(params.userbudget, community.lowest_price, community.highest_price) : 50;
          
          // 计算历史成交率评分（如果没有用户画像数据，历史评分为50分）
          const conversionRate = params.customerprofile ? 
            this.getConversionRate(community.conversion_rates, params.customerprofile) : 0;
          const historicalScore = params.customerprofile ? this.getHistoricalScore(conversionRate) : 50;
          
          // 计算综合评分（即使某些字段缺失，也计算总分）
          const totalScore = Math.round(commuteScore * 0.4 + budgetScore * 0.4 + historicalScore * 0.2);
          
          // 只有在有有效数据时才添加推荐（需要有通勤时间数据或用户预算）
          const hasCommuteData = commuteTime >= 0 && Object.keys(params.commuteTimes).length > 0;
          const hasBudgetData = params.userbudget > 0;
          const hasValidData = hasCommuteData || hasBudgetData;
          if (!hasValidData) {
            continue;
          }
          
          // 生成推荐理由
          const reason = this.buildRecommendationReason(community, {
            commuteTime,
            commuteScore,
            budgetScore,
            historicalScore,
            totalScore
          });

          // 确定推荐等级和颜色
          const { recommendation, color } = this.getRecommendationLevel(totalScore);

          recommendations.push({
            community: community.community,
            metrostation: community.metrostation,
            lowest_price: community.lowest_price || 0,
            highest_price: community.highest_price || 0,
            conversion_rates: community.conversion_rates || {},
            score: totalScore,
            commuteTime,
            commuteScore,
            budgetScore,
            historicalScore,
            reason,
            recommendation,
            color
          });

        } catch (error) {
          console.error(`计算社区 ${community.community} 推荐失败:`, error);
        }
      }

      // 按评分排序
      recommendations.sort((a, b) => b.score - a.score);
      
      return recommendations;

    } catch (error) {
      console.error('使用传入数据计算推荐失败:', error);
      return [];
    }
  }

  /**
   * 使用缓存的通勤时间数据计算推荐（保持向后兼容）
   */
  async getRecommendationsWithCache(params: RecommendationParams & { cachedCommuteTimes: Record<string, number> }): Promise<CommunityRecommendation[]> {
    // 直接调用新的方法，避免重复代码
    return this.getRecommendationsWithCommuteTimes({
      worklocation: params.worklocation,
      userbudget: params.userbudget,
      customerprofile: params.customerprofile,
      followupId: params.followupId,
      commuteTimes: params.cachedCommuteTimes
    });
  }

  /**
   * 从extended_data获取缓存的通勤时间
   */
  async getCachedCommuteTimes(followupId: number): Promise<Record<string, number> | null> {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select('extended_data')
        .eq('id', followupId)
        .single();

      if (error || !data?.extended_data) {
        return null;
      }

      return data.extended_data.commute_times || null;
    } catch (error) {
      console.error('获取缓存通勤时间失败:', error);
      return null;
    }
  }

  /**
   * 获取单个社区的通勤时间（从数据库获取）
   */
  async getCommuteTime(followupId: number, worklocation: string, community: string): Promise<number> {
    try {
      // 从数据库获取缓存的通勤时间
      const cachedTimes = await this.getCachedCommuteTimes(followupId);
      if (cachedTimes && cachedTimes[community]) {
        return cachedTimes[community];
      }

      // 如果没有缓存，返回默认值
      return 50; // 默认通勤时间
    } catch (error) {
      console.error('获取通勤时间失败:', error);
      return 50; // 默认值
    }
  }

  /**
   * 获取缓存的推荐（从数据库）
   */
  private async getCachedRecommendations(followupId: number): Promise<CommunityRecommendation[]> {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select('extended_data')
        .eq('id', followupId)
        .single();

      if (error || !data?.extended_data) {
        return [];
      }

      return data.extended_data.community_recommendations || [];
    } catch (error) {
      console.error('获取缓存推荐失败:', error);
      return [];
    }
  }

  /**
   * 缓存推荐结果到数据库
   */
  private async cacheRecommendations(followupId: number, recommendations: CommunityRecommendation[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('followups')
        .update({
          extended_data: {
            community_recommendations: recommendations
          }
        })
        .eq('id', followupId);

      if (error) {
        console.error('缓存推荐失败:', error);
      } else {
      }
    } catch (error) {
      console.error('缓存推荐失败:', error);
    }
  }

  /**
   * 清除本地缓存（用于强制刷新）
   */
  public clearLocalCache(): void {
    CommunityRecommendationService.communityDataCache = [];
    CommunityRecommendationService.cacheTimestamp = 0;
  }

  /**
   * 获取缓存状态信息
   */
  public getCacheStatus(): { hasData: boolean; age: number; count: number } {
    const now = Date.now();
    const age = now - CommunityRecommendationService.cacheTimestamp;
    const count = CommunityRecommendationService.communityDataCache.length;
    
    return {
      hasData: count > 0,
      age: Math.round(age / 1000), // 转换为秒
      count
    };
  }
}

export default CommunityRecommendationService;
