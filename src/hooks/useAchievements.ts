import { useState, useEffect, useCallback } from 'react';
import { achievementApi, type Achievement, type AvatarFrame, type Badge } from '../api/achievementApi';
import { useUser } from '../context/UserContext';

export interface AchievementStats {
  total: number;
  completed: number;
  in_progress: number;
  completion_rate: number;
  total_points_earned: number;
  total_avatar_frames: number;
  total_badges: number;
}

export const useAchievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [avatarFrames, setAvatarFrames] = useState<AvatarFrame[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<number | null>(null);

  // 从UserContext获取用户信息
  const { profile } = useUser();

  // 当profile变化时更新profileId
  useEffect(() => {
    if (profile?.id) {
      setProfileId(profile.id);
    }
  }, [profile]);

  // 加载成就数据
  const loadAchievements = useCallback(async (userId: number) => {
    try {
      setLoading(true);
      const [achievementsData, avatarFramesData, badgesData, statsData] = await Promise.all([
        achievementApi.getUserAchievements(userId),
        achievementApi.getUserAvatarFrames(userId),
        achievementApi.getUserBadges(userId),
        achievementApi.getAchievementStats(userId)
      ]);

      setAchievements(achievementsData);
      setAvatarFrames(avatarFramesData);
      setBadges(badgesData);
      setStats(statsData);
    } catch (error) {
      console.error('加载成就数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 当用户ID变化时加载数据
  useEffect(() => {
    if (profileId) {
      loadAchievements(profileId);
    }
  }, [profileId, loadAchievements]);

  // 更新成就进度
  const updateProgress = useCallback(async (
    achievementCode: string,
    progressChange: number,
    triggerSource: string,
    triggerData?: any
  ) => {
    if (!profileId) return;

    try {
      const result = await achievementApi.updateAchievementProgress(
        profileId,
        achievementCode,
        progressChange,
        triggerSource,
        triggerData
      );

      if (result.success) {
        // 重新加载成就数据
        await loadAchievements(profileId);
        
        // 如果成就完成，显示通知
        if (result.is_completed && result.points_reward && result.points_reward > 0) {
          // 这里可以触发成就完成通知
        }
      }

      return result;
    } catch (error) {
      console.error('更新成就进度失败:', error);
      throw error;
    }
  }, [profileId, loadAchievements]);

  // 装备头像框
  const equipAvatarFrame = useCallback(async (frameId: string) => {
    if (!profileId) return;

    try {
      await achievementApi.equipAvatarFrame(profileId, frameId);
      // 重新加载头像框数据
      const avatarFramesData = await achievementApi.getUserAvatarFrames(profileId);
      setAvatarFrames(avatarFramesData);
    } catch (error) {
      console.error('装备头像框失败:', error);
      throw error;
    }
  }, [profileId]);

  // 装备勋章
  const equipBadge = useCallback(async (badgeId: string) => {
    if (!profileId) return;

    try {
      await achievementApi.equipBadge(profileId, badgeId);
      // 重新加载勋章数据
      const badgesData = await achievementApi.getUserBadges(profileId);
      setBadges(badgesData);
    } catch (error) {
      console.error('装备勋章失败:', error);
      throw error;
    }
  }, [profileId]);

  // 获取成就分类数据
  const getAchievementsByCategory = useCallback(() => {
    const categories = ['milestone', 'skill', 'social', 'special'] as const;
    const result: Record<string, Achievement[]> = {};
    
    categories.forEach(category => {
      result[category] = achievements.filter(a => a.category === category);
    });
    
    return result;
  }, [achievements]);

  // 获取已完成的成就
  const getCompletedAchievements = useCallback(() => {
    return achievements.filter(a => a.is_completed);
  }, [achievements]);

  // 获取进行中的成就
  const getInProgressAchievements = useCallback(() => {
    return achievements.filter(a => !a.is_completed && a.progress > 0);
  }, [achievements]);

  // 获取未开始的成就
  const getNotStartedAchievements = useCallback(() => {
    return achievements.filter(a => !a.is_completed && a.progress === 0);
  }, [achievements]);

  // 获取当前装备的头像框
  const getEquippedAvatarFrame = useCallback(() => {
    return avatarFrames.find(frame => frame.is_equipped);
  }, [avatarFrames]);

  // 获取当前装备的勋章
  const getEquippedBadge = useCallback(() => {
    return badges.find(badge => badge.is_equipped);
  }, [badges]);

  // 刷新数据
  const refresh = useCallback(() => {
    if (profileId) {
      loadAchievements(profileId);
    }
  }, [profileId, loadAchievements]);

  // 全局事件监听，自动刷新头像框等数据
  useEffect(() => {
    const handleAvatarRefresh = (e: StorageEvent) => {
      if (e.key === 'avatar_refresh_token') {
        refresh();
      }
    };
    
    const handleCustomAvatarRefresh = () => {
      refresh();
    };
    
    window.addEventListener('storage', handleAvatarRefresh);
    window.addEventListener('avatar_refresh_token', handleCustomAvatarRefresh);
    
    return () => {
      window.removeEventListener('storage', handleAvatarRefresh);
      window.removeEventListener('avatar_refresh_token', handleCustomAvatarRefresh);
    };
  }, [refresh]);

  return {
    // 数据
    achievements,
    avatarFrames,
    badges,
    stats,
    loading,
    profileId,
    
    // 方法
    updateProgress,
    equipAvatarFrame,
    equipBadge,
    refresh,
    
    // 计算属性
    getAchievementsByCategory,
    getCompletedAchievements,
    getInProgressAchievements,
    getNotStartedAchievements,
    getEquippedAvatarFrame,
    getEquippedBadge,
    
    // 工具方法
    getRarityColor: achievementApi.getRarityColor,
    getRarityText: achievementApi.getRarityText,
    getCategoryText: achievementApi.getCategoryText,
    getCategoryColor: achievementApi.getCategoryColor
  };
}; 