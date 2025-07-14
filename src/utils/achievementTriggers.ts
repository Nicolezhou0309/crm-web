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

  // 荣誉发放触发器（自定义）
  static async onHonorGranted(userId: number, frameId: string, frameName: string, grantedBy: number, notes?: string) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        frameId, // 使用 frame_id 作为 achievement_id
        1,
        'honor_grant',
        {
          frame_id: frameId,
          frame_name: frameName,
          granted_by: grantedBy,
          notes: notes,
          granted_at: new Date().toISOString()
        }
      );

      console.log('✅ 荣誉发放记录已创建');
    } catch (error) {
      console.error('❌ 创建荣誉发放记录失败:', error);
    }
  }

  // 活动参与触发器（自定义）
  static async onEventParticipation(userId: number, eventId: string, eventName: string, participationType: string) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        'event_participation',
        1,
        'event_participation',
        {
          event_id: eventId,
          event_name: eventName,
          participation_type: participationType,
          participated_at: new Date().toISOString()
        }
      );

      console.log('✅ 活动参与记录已创建');
    } catch (error) {
      console.error('❌ 创建活动参与记录失败:', error);
    }
  }

  // 首次登录触发器（自定义）
  static async onFirstLogin(userId: number) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        'first_login',
        1,
        'first_login',
        {
          login_time: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      );

      console.log('✅ 首次登录成就已记录');
    } catch (error) {
      console.error('❌ 记录首次登录失败:', error);
    }
  }

  // 资料完善触发器（自定义）
  static async onProfileComplete(userId: number, profileData: any) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        'profile_complete',
        1,
        'profile_complete',
        {
          completed_fields: Object.keys(profileData),
          completed_at: new Date().toISOString()
        }
      );

      console.log('✅ 资料完善成就已记录');
    } catch (error) {
      console.error('❌ 记录资料完善失败:', error);
    }
  }

  // 推荐成功触发器（自定义）
  static async onReferralSuccess(userId: number, referredUserId: number, referralType: string) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        'referral_success',
        1,
        'referral_success',
        {
          referred_user_id: referredUserId,
          referral_type: referralType,
          success_at: new Date().toISOString()
        }
      );

      console.log('✅ 推荐成功成就已记录');
    } catch (error) {
      console.error('❌ 记录推荐成功失败:', error);
    }
  }

  // 手动发放触发器（自定义）
  static async onManualGrant(userId: number, achievementCode: string, grantedBy: number, reason: string) {
    try {
      await achievementApi.updateAchievementProgress(
        userId,
        achievementCode,
        1,
        'manual_grant',
        {
          granted_by: grantedBy,
          reason: reason,
          granted_at: new Date().toISOString()
        }
      );

      console.log('✅ 手动发放记录已创建');
    } catch (error) {
      console.error('❌ 创建手动发放记录失败:', error);
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