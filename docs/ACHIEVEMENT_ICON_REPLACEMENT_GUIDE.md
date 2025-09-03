# 成就系统图标和勋章替换指南

## 概述

本指南详细说明如何替换成就系统中的图标和勋章，包括数据库操作、前端组件更新和最佳实践。

## 1. 数据库层面的替换

### 1.1 替换成就图标

成就图标存储在 `achievements` 表的 `icon` 字段中，支持 emoji 和图标代码。

#### 方法一：直接更新数据库

```sql
-- 查看当前成就图标
SELECT code, name, icon FROM achievements WHERE is_active = true;

-- 更新特定成就的图标
UPDATE achievements 
SET icon = '🏅', updated_at = now()
WHERE code = 'first_deal';

-- 批量更新多个成就图标
UPDATE achievements 
SET icon = CASE 
  WHEN code = 'first_followup' THEN '📋'
  WHEN code = 'followup_master' THEN '📊'
  WHEN code = 'first_deal' THEN '💎'
  WHEN code = 'deal_master' THEN '🏆'
  WHEN code = 'conversion_master' THEN '📈'
  WHEN code = 'points_collector' THEN '💰'
  WHEN code = 'team_helper' THEN '🤝'
  WHEN code = 'daily_checkin' THEN '📅'
  ELSE icon
END,
updated_at = now()
WHERE code IN ('first_followup', 'followup_master', 'first_deal', 'deal_master', 
               'conversion_master', 'points_collector', 'team_helper', 'daily_checkin');
```

#### 方法二：使用管理函数

```sql
-- 创建成就图标更新函数
CREATE OR REPLACE FUNCTION update_achievement_icon(
  p_achievement_code text,
  p_new_icon text,
  p_new_color text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_achievement_id uuid;
BEGIN
  SELECT id INTO v_achievement_id
  FROM achievements 
  WHERE code = p_achievement_code AND is_active = true;
  
  IF v_achievement_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Achievement not found');
  END IF;
  
  UPDATE achievements 
  SET 
    icon = p_new_icon,
    color = COALESCE(p_new_color, color),
    updated_at = now()
  WHERE id = v_achievement_id;
  
  RETURN jsonb_build_object('success', true, 'achievement_id', v_achievement_id);
END;
$$;

-- 使用函数更新图标
SELECT update_achievement_icon('first_deal', '💎', '#fa8c16');
```

### 1.2 替换勋章图标

勋章图标存储在 `badges` 表的 `icon` 字段中。

```sql
-- 查看当前勋章
SELECT name, icon, color FROM badges WHERE is_active = true;

-- 更新特定勋章
UPDATE badges 
SET icon = '🎖️', color = '#ff6b35', updated_at = now()
WHERE name = '新手销售';

-- 批量更新勋章
UPDATE badges 
SET icon = CASE 
  WHEN name = '新手销售' THEN '🎖️'
  WHEN name = '成交达人' THEN '💎'
  WHEN name = '转化大师' THEN '🏆'
  WHEN name = '团队领袖' THEN '👑'
  WHEN name = '连续签到' THEN '📅'
  ELSE icon
END,
color = CASE 
  WHEN name = '新手销售' THEN '#52c41a'
  WHEN name = '成交达人' THEN '#1890ff'
  WHEN name = '转化大师' THEN '#fa8c16'
  WHEN name = '团队领袖' THEN '#722ed1'
  WHEN name = '连续签到' THEN '#eb2f96'
  ELSE color
END,
updated_at = now()
WHERE name IN ('新手销售', '成交达人', '转化大师', '团队领袖', '连续签到');
```

### 1.3 替换头像框样式

头像框样式存储在 `avatar_frames` 表的 `frame_data` 字段中（JSON格式）。

```sql
-- 查看当前头像框
SELECT name, frame_type, frame_data FROM avatar_frames WHERE is_active = true;

-- 更新特定头像框样式
UPDATE avatar_frames 
SET frame_data = '{"border": "4px solid #ff6b35", "borderRadius": "50%", "boxShadow": "0 0 15px #ff6b35", "background": "linear-gradient(45deg, #ff6b35, #f7931e)"}',
    updated_at = now()
WHERE name = '青铜头像框';

-- 创建新的头像框样式
INSERT INTO avatar_frames (name, description, frame_type, frame_data, rarity, sort_order) VALUES
('彩虹头像框', '彩虹特效头像框', 'border', '{"border": "3px solid transparent", "borderRadius": "50%", "background": "linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff)", "backgroundClip": "padding-box", "boxShadow": "0 0 20px rgba(255,0,0,0.5)"}', 'epic', 5);
```

## 2. 前端组件更新

### 2.1 更新成就系统组件

修改 `src/components/AchievementSystem.tsx` 以支持自定义图标：

```typescript
// 在 AchievementSystem.tsx 中添加图标映射
const ICON_MAPPING = {
  // 成就图标映射
  'first_followup': '📋',
  'followup_master': '📊', 
  'first_deal': '💎',
  'deal_master': '🏆',
  'conversion_master': '📈',
  'points_collector': '💰',
  'team_helper': '🤝',
  'daily_checkin': '📅',
  
  // 勋章图标映射
  '新手销售': '🎖️',
  '成交达人': '💎',
  '转化大师': '🏆',
  '团队领袖': '👑',
  '连续签到': '📅'
};

// 在渲染成就时使用映射
const getAchievementIcon = (achievement: Achievement) => {
  return ICON_MAPPING[achievement.code] || achievement.icon || '🏆';
};
```

### 2.2 创建图标管理组件

```typescript
// src/components/AchievementIconManager.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

interface IconManagerProps {
  onIconUpdate?: () => void;
}

export const AchievementIconManager: React.FC<IconManagerProps> = ({ onIconUpdate }) => {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取成就列表
      const { data: achievementsData } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      // 获取勋章列表
      const { data: badgesData } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      setAchievements(achievementsData || []);
      setBadges(badgesData || []);
    } catch (error) {
      console.error('加载图标数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAchievementIcon = async (achievementId: string, newIcon: string, newColor?: string) => {
    try {
      const { error } = await supabase
        .from('achievements')
        .update({ 
          icon: newIcon, 
          color: newColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', achievementId);

      if (error) throw error;
      
      // 重新加载数据
      await loadData();
      onIconUpdate?.();
    } catch (error) {
      console.error('更新成就图标失败:', error);
    }
  };

  const updateBadgeIcon = async (badgeId: string, newIcon: string, newColor?: string) => {
    try {
      const { error } = await supabase
        .from('badges')
        .update({ 
          icon: newIcon, 
          color: newColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', badgeId);

      if (error) throw error;
      
      await loadData();
      onIconUpdate?.();
    } catch (error) {
      console.error('更新勋章图标失败:', error);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="achievement-icon-manager">
      <h3>成就图标管理</h3>
      
      <div className="achievements-section">
        <h4>成就图标</h4>
        {achievements.map(achievement => (
          <div key={achievement.id} className="icon-item">
            <span className="current-icon">{achievement.icon}</span>
            <span className="achievement-name">{achievement.name}</span>
            <input 
              type="text" 
              placeholder="新图标 (emoji)"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  updateAchievementIcon(achievement.id, target.value);
                  target.value = '';
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="badges-section">
        <h4>勋章图标</h4>
        {badges.map(badge => (
          <div key={badge.id} className="icon-item">
            <span className="current-icon">{badge.icon}</span>
            <span className="badge-name">{badge.name}</span>
            <input 
              type="text" 
              placeholder="新图标 (emoji)"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  updateBadgeIcon(badge.id, target.value);
                  target.value = '';
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 2.3 添加样式

```css
/* 在 AchievementSystem.tsx 中添加样式 */
.achievement-icon-manager {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  margin: 20px 0;
}

.icon-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.current-icon {
  font-size: 24px;
  min-width: 30px;
  text-align: center;
}

.achievement-name,
.badge-name {
  flex: 1;
  font-weight: 500;
}

.icon-item input {
  padding: 5px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  width: 120px;
}
```

## 3. API 接口更新

### 3.1 更新成就API

在 `src/api/achievementApi.ts` 中添加图标管理接口：

```typescript
// 更新成就图标
export const updateAchievementIcon = async (
  achievementId: string, 
  icon: string, 
  color?: string
): Promise<ApiResponse> => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .update({ 
        icon, 
        color: color || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', achievementId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('更新成就图标失败:', error);
    return { success: false, error: error.message };
  }
};

// 更新勋章图标
export const updateBadgeIcon = async (
  badgeId: string, 
  icon: string, 
  color?: string
): Promise<ApiResponse> => {
  try {
    const { data, error } = await supabase
      .from('badges')
      .update({ 
        icon, 
        color: color || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', badgeId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('更新勋章图标失败:', error);
    return { success: false, error: error.message };
  }
};

// 更新头像框样式
export const updateAvatarFrame = async (
  frameId: string, 
  frameData: any
): Promise<ApiResponse> => {
  try {
    const { data, error } = await supabase
      .from('avatar_frames')
      .update({ 
        frame_data: frameData,
        updated_at: new Date().toISOString()
      })
      .eq('id', frameId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('更新头像框失败:', error);
    return { success: false, error: error.message };
  }
};
```

## 4. 常用图标推荐

### 4.1 成就图标推荐

```typescript
const ACHIEVEMENT_ICONS = {
  // 里程碑成就
  'first_followup': '📋',      // 首次跟进
  'followup_master': '📊',     // 跟进达人
  'first_deal': '💎',          // 首次成交
  'deal_master': '🏆',         // 成交大师
  
  // 技能成就
  'conversion_master': '📈',   // 转化大师
  'points_collector': '💰',     // 积分收集者
  
  // 社交成就
  'team_helper': '🤝',         // 团队助手
  
  // 特殊成就
  'daily_checkin': '📅',       // 连续签到
  'help_colleague': '👥',      // 帮助同事
  'perfect_deal': '⭐',        // 完美成交
  'speed_dealer': '⚡',        // 快速成交
  'customer_service': '🎧',    // 客户服务
  'team_leader': '👑',         // 团队领袖
  'mentor': '🎓',              // 导师
  'innovator': '💡',           // 创新者
  'persistence': '🔨',         // 坚持不懈
  'excellence': '🌟',          // 卓越表现
};
```

### 4.2 勋章图标推荐

```typescript
const BADGE_ICONS = {
  // 基础勋章
  '新手销售': '🎖️',
  '成交达人': '💎',
  '转化大师': '🏆',
  '团队领袖': '👑',
  '连续签到': '📅',
  
  // 高级勋章
  '销售冠军': '🥇',
  '服务之星': '⭐',
  '创新先锋': '💡',
  '团队协作': '🤝',
  '客户满意': '😊',
  '效率达人': '⚡',
  '质量保证': '✅',
  '成长之星': '🌱',
  '经验丰富': '🎯',
  '专业认证': '🏅',
};
```

### 4.3 头像框样式推荐

```typescript
const AVATAR_FRAME_STYLES = {
  // 基础头像框
  'default': {
    border: '2px solid #e0e0e0',
    borderRadius: '50%'
  },
  
  // 金属系列
  'bronze': {
    border: '3px solid #cd7f32',
    borderRadius: '50%',
    boxShadow: '0 0 10px #cd7f32'
  },
  'silver': {
    border: '3px solid #c0c0c0',
    borderRadius: '50%',
    boxShadow: '0 0 15px #c0c0c0'
  },
  'gold': {
    border: '3px solid #ffd700',
    borderRadius: '50%',
    boxShadow: '0 0 20px #ffd700'
  },
  'platinum': {
    border: '3px solid #b9f2ff',
    borderRadius: '50%',
    boxShadow: '0 0 25px #b9f2ff'
  },
  
  // 特效头像框
  'rainbow': {
    border: '3px solid transparent',
    borderRadius: '50%',
    background: 'linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff)',
    backgroundClip: 'padding-box',
    boxShadow: '0 0 20px rgba(255,0,0,0.5)'
  },
  'fire': {
    border: '3px solid #ff6b35',
    borderRadius: '50%',
    boxShadow: '0 0 15px #ff6b35',
    background: 'linear-gradient(45deg, #ff6b35, #f7931e)'
  },
  'ice': {
    border: '3px solid #87ceeb',
    borderRadius: '50%',
    boxShadow: '0 0 15px #87ceeb',
    background: 'linear-gradient(45deg, #87ceeb, #4682b4)'
  }
};
```

## 5. 批量替换脚本

### 5.1 数据库批量替换脚本

```sql
-- 批量替换成就图标脚本
DO $$
DECLARE
  achievement_record RECORD;
BEGIN
  FOR achievement_record IN 
    SELECT id, code, name FROM achievements WHERE is_active = true
  LOOP
    -- 根据成就代码设置新图标
    CASE achievement_record.code
      WHEN 'first_followup' THEN
        UPDATE achievements SET icon = '📋', color = '#52c41a' WHERE id = achievement_record.id;
      WHEN 'followup_master' THEN
        UPDATE achievements SET icon = '📊', color = '#1890ff' WHERE id = achievement_record.id;
      WHEN 'first_deal' THEN
        UPDATE achievements SET icon = '💎', color = '#fa8c16' WHERE id = achievement_record.id;
      WHEN 'deal_master' THEN
        UPDATE achievements SET icon = '🏆', color = '#722ed1' WHERE id = achievement_record.id;
      WHEN 'conversion_master' THEN
        UPDATE achievements SET icon = '📈', color = '#eb2f96' WHERE id = achievement_record.id;
      WHEN 'points_collector' THEN
        UPDATE achievements SET icon = '💰', color = '#52c41a' WHERE id = achievement_record.id;
      WHEN 'team_helper' THEN
        UPDATE achievements SET icon = '🤝', color = '#1890ff' WHERE id = achievement_record.id;
      WHEN 'daily_checkin' THEN
        UPDATE achievements SET icon = '📅', color = '#fa8c16' WHERE id = achievement_record.id;
    END CASE;
  END LOOP;
  
  RAISE NOTICE '成就图标批量更新完成！';
END $$;
```

### 5.2 前端批量替换工具

```typescript
// src/utils/iconReplacer.ts
import { supabase } from '../supaClient';

export const batchReplaceIcons = async () => {
  const iconMapping = {
    'first_followup': '📋',
    'followup_master': '📊',
    'first_deal': '💎',
    'deal_master': '🏆',
    'conversion_master': '📈',
    'points_collector': '💰',
    'team_helper': '🤝',
    'daily_checkin': '📅'
  };

  try {
    for (const [code, icon] of Object.entries(iconMapping)) {
      const { error } = await supabase
        .from('achievements')
        .update({ icon, updated_at: new Date().toISOString() })
        .eq('code', code);

      if (error) {
        console.error(`更新成就 ${code} 图标失败:`, error);
      } else {
        console.log(`成功更新成就 ${code} 图标为 ${icon}`);
      }
    }
    
    console.log('批量图标替换完成！');
  } catch (error) {
    console.error('批量替换失败:', error);
  }
};
```

## 6. 最佳实践

### 6.1 图标选择原则

1. **一致性**: 同一类别的成就使用相似风格的图标
2. **可识别性**: 图标应该能清楚表达成就含义
3. **美观性**: 选择视觉效果好的 emoji 或图标
4. **兼容性**: 确保图标在不同设备上都能正常显示

### 6.2 颜色搭配建议

```typescript
const COLOR_SCHEMES = {
  // 成就等级颜色
  'common': '#52c41a',    // 绿色 - 基础
  'rare': '#1890ff',      // 蓝色 - 稀有
  'epic': '#fa8c16',      // 橙色 - 史诗
  'legendary': '#722ed1', // 紫色 - 传说
  
  // 成就类型颜色
  'milestone': '#1890ff', // 里程碑 - 蓝色
  'skill': '#fa8c16',     // 技能 - 橙色
  'social': '#52c41a',    // 社交 - 绿色
  'special': '#eb2f96',   // 特殊 - 粉色
};
```

### 6.3 测试建议

1. **预览测试**: 在更新前预览新图标效果
2. **兼容性测试**: 在不同设备和浏览器上测试
3. **用户反馈**: 收集用户对新图标的反馈
4. **性能测试**: 确保图标更新不影响系统性能

## 7. 故障排除

### 7.1 常见问题

**问题**: 图标更新后前端没有显示
**解决**: 清除浏览器缓存，检查前端组件是否正确刷新

**问题**: 数据库更新失败
**解决**: 检查数据库权限，确认表结构正确

**问题**: 图标显示异常
**解决**: 检查 emoji 编码，确保使用标准 Unicode

### 7.2 调试工具

```typescript
// 调试函数
export const debugIcons = async () => {
  const { data: achievements } = await supabase
    .from('achievements')
    .select('code, name, icon, color')
    .eq('is_active', true);

  const { data: badges } = await supabase
    .from('badges')
    .select('name, icon, color')
    .eq('is_active', true);

  console.log('当前成就图标:', achievements);
  console.log('当前勋章图标:', badges);
};
```

## 总结

通过以上指南，您可以：

1. **数据库层面**: 直接更新成就和勋章的图标
2. **前端层面**: 使用管理组件可视化更新图标
3. **API层面**: 通过接口批量更新图标
4. **批量操作**: 使用脚本快速替换多个图标

建议在更新前先备份数据，并在测试环境中验证效果后再应用到生产环境。 