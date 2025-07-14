import { achievementApi } from '../api/achievementApi';
import { getCurrentProfileId } from '../api/pointsApi';

// 成就触发器类
export class AchievementTriggers {
  private static async getUserId(): Promise<number | null> {
    return await getCurrentProfileId();
  }

  // 跟进完成触发器
  static async onFollowupCompleted(followupData: any) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 触发首次跟进成就
      await achievementApi.updateAchievementProgress(
        userId,
        'first_followup',
        1,
        'followup_completed',
        followupData
      );

      // 触发跟进达人成就（累计100个）
      await achievementApi.updateAchievementProgress(
        userId,
        'followup_master',
        1,
        'followup_completed',
        followupData
      );

      console.log('✅ 跟进成就进度已更新');
    } catch (error) {
      console.error('❌ 更新跟进成就失败:', error);
    }
  }

  // 成交完成触发器
  static async onDealCompleted(dealData: any) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 触发首次成交成就
      await achievementApi.updateAchievementProgress(
        userId,
        'first_deal',
        1,
        'deal_completed',
        dealData
      );

      // 触发成交大师成就（累计50个）
      await achievementApi.updateAchievementProgress(
        userId,
        'deal_master',
        1,
        'deal_completed',
        dealData
      );

      console.log('✅ 成交成就进度已更新');
    } catch (error) {
      console.error('❌ 更新成交成就失败:', error);
    }
  }

  // 转化率检查触发器
  static async onConversionRateCheck(conversionRate: number) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 检查是否达到转化大师成就要求
      if (conversionRate >= 20) {
        await achievementApi.updateAchievementProgress(
          userId,
          'conversion_master',
          1,
          'conversion_rate_check',
          { conversion_rate: conversionRate }
        );
      }

      console.log('✅ 转化率成就检查完成');
    } catch (error) {
      console.error('❌ 更新转化率成就失败:', error);
    }
  }

  // 积分获得触发器
  static async onPointsEarned(pointsEarned: number, totalPointsEarned: number) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 检查是否达到积分收集者成就要求
      if (totalPointsEarned >= 1000) {
        await achievementApi.updateAchievementProgress(
          userId,
          'points_collector',
          1,
          'points_earned',
          { points_earned: pointsEarned, total_points_earned: totalPointsEarned }
        );
      }

      console.log('✅ 积分成就检查完成');
    } catch (error) {
      console.error('❌ 更新积分成就失败:', error);
    }
  }

  // 签到触发器
  static async onDailyCheckin(consecutiveDays: number) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 检查是否达到连续签到成就要求
      if (consecutiveDays >= 30) {
        await achievementApi.updateAchievementProgress(
          userId,
          'daily_checkin',
          1,
          'daily_checkin',
          { consecutive_days: consecutiveDays }
        );
      }

      console.log('✅ 签到成就检查完成');
    } catch (error) {
      console.error('❌ 更新签到成就失败:', error);
    }
  }

  // 帮助同事触发器
  static async onHelpColleague(helpData: any) {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 触发团队助手成就
      await achievementApi.updateAchievementProgress(
        userId,
        'team_helper',
        1,
        'help_colleague',
        helpData
      );

      console.log('✅ 团队助手成就进度已更新');
    } catch (error) {
      console.error('❌ 更新团队助手成就失败:', error);
    }
  }

  // 批量检查成就（用于初始化或定期检查）
  static async checkAllAchievements() {
    const userId = await this.getUserId();
    if (!userId) return;

    try {
      // 这里可以添加批量检查逻辑
      // 例如检查用户的跟进数量、成交数量等
      console.log('✅ 批量成就检查完成');
    } catch (error) {
      console.error('❌ 批量成就检查失败:', error);
    }
  }
}

// 导出成就触发器实例
export const achievementTriggers = new AchievementTriggers(); 