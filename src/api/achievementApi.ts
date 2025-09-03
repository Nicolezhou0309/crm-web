import { supabase } from '../supaClient';

// 成就类型定义
export interface Achievement {
  achievement_id: string;
  code: string;
  name: string;
  description: string;
  category: 'milestone' | 'skill' | 'social' | 'special';
  icon: string;
  color: string;
  points_reward: number;
  avatar_frame_id?: string;
  badge_id?: string;
  progress: number;
  target: number;
  is_completed: boolean;
  completed_at?: string;
  points_earned: number;
  progress_percentage: number;
}

export interface AvatarFrame {
  frame_id: string;
  name: string;
  description?: string;
  frame_type: 'border' | 'background' | 'overlay';
  frame_data: any;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  is_equipped: boolean;
  unlocked_at: string;
  icon_url?: string; // 新增，头像框图片URL
}

export interface Badge {
  badge_id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  is_equipped: boolean;
  unlocked_at: string;
}

export interface AchievementProgressResult {
  success: boolean;
  achievement_id?: string;
  old_progress?: number;
  new_progress?: number;
  is_completed?: boolean;
  points_reward?: number;
  error?: string;
  message?: string;
}

// 成就系统API类
class AchievementApi {
  // 获取用户成就列表
  async getUserAchievements(userId: number): Promise<Achievement[]> {
    const { data, error } = await supabase.rpc('get_user_achievements', {
      p_user_id: userId
    });
    
    if (error) throw error;
    return data || [];
  }

  // 更新成就进度
  async updateAchievementProgress(
    userId: number,
    achievementCode: string,
    progressChange: number,
    triggerSource: string,
    triggerData?: any
  ): Promise<AchievementProgressResult> {
    const { data, error } = await supabase.rpc('update_achievement_progress', {
      p_user_id: userId,
      p_achievement_code: achievementCode,
      p_progress_change: progressChange,
      p_trigger_source: triggerSource,
      p_trigger_data: triggerData
    });
    
    if (error) throw error;
    return data;
  }

  // 获取用户头像框
  async getUserAvatarFrames(userId: number): Promise<AvatarFrame[]> {
    const { data, error } = await supabase.rpc('get_user_avatar_frames', {
      p_user_id: userId
    });
    
    if (error) throw error;
    return data || [];
  }

  // 获取用户勋章
  async getUserBadges(userId: number): Promise<Badge[]> {
    const { data, error } = await supabase.rpc('get_user_badges', {
      p_user_id: userId
    });
    
    if (error) throw error;
    return data || [];
  }

  // 装备头像框
  async equipAvatarFrame(userId: number, frameId: string): Promise<boolean> {
    // 先取消所有装备状态
    const { error: unequipError } = await supabase
      .from('user_avatar_frames')
      .update({ is_equipped: false })
      .eq('user_id', userId);
    
    if (unequipError) throw unequipError;
    
    // 如果 frameId 不为空，则装备指定头像框
    if (frameId && frameId.trim() !== '') {
      const { error: equipError } = await supabase
        .from('user_avatar_frames')
        .update({ is_equipped: true })
        .eq('user_id', userId)
        .eq('frame_id', frameId);
      
      if (equipError) throw equipError;
    }
    
    return true;
  }

  // 装备勋章
  async equipBadge(userId: number, badgeId: string): Promise<boolean> {
    // 先取消所有装备状态
    const { error: unequipError } = await supabase
      .from('user_badges')
      .update({ is_equipped: false })
      .eq('user_id', userId);
    
    if (unequipError) throw unequipError;
    
    // 装备指定勋章
    const { error: equipError } = await supabase
      .from('user_badges')
      .update({ is_equipped: true })
      .eq('user_id', userId)
      .eq('badge_id', badgeId);
    
    if (equipError) throw equipError;
    
    return true;
  }

  // 获取成就统计
  async getAchievementStats(userId: number): Promise<{
    total: number;
    completed: number;
    in_progress: number;
    completion_rate: number;
    total_points_earned: number;
    total_avatar_frames: number;
    total_badges: number;
  }> {
    const achievements = await this.getUserAchievements(userId);
    const avatarFrames = await this.getUserAvatarFrames(userId);
    const badges = await this.getUserBadges(userId);
    
    const completed = achievements.filter(a => a.is_completed).length;
    const inProgress = achievements.filter(a => !a.is_completed && a.progress > 0).length;
    const totalPointsEarned = achievements.reduce((sum, a) => sum + a.points_earned, 0);
    
    return {
      total: achievements.length,
      completed,
      in_progress: inProgress,
      completion_rate: achievements.length > 0 ? Math.round((completed / achievements.length) * 100) : 0,
      total_points_earned: totalPointsEarned,
      total_avatar_frames: avatarFrames.length,
      total_badges: badges.length
    };
  }

  // 获取稀有度颜色
  getRarityColor(rarity: string): string {
    const colorMap: Record<string, string> = {
      'common': '#52c41a',
      'rare': '#1890ff',
      'epic': '#fa8c16',
      'legendary': '#722ed1'
    };
    return colorMap[rarity] || '#666';
  }

  // 获取稀有度文本
  getRarityText(rarity: string): string {
    const textMap: Record<string, string> = {
      'common': '基础',
      'rare': '稀有',
      'epic': '史诗',
      'legendary': '传说'
    };
    return textMap[rarity] || '未知';
  }

  // 获取成就分类文本
  getCategoryText(category: string): string {
    const textMap: Record<string, string> = {
      'milestone': '里程碑',
      'skill': '技能',
      'social': '社交',
      'special': '特殊'
    };
    return textMap[category] || '未知';
  }

  // 获取成就分类颜色
  getCategoryColor(category: string): string {
    const colorMap: Record<string, string> = {
      'milestone': '#52c41a',
      'skill': '#1890ff',
      'social': '#fa8c16',
      'special': '#722ed1'
    };
    return colorMap[category] || '#666';
  }
}

// 导出API实例
export const achievementApi = new AchievementApi(); 