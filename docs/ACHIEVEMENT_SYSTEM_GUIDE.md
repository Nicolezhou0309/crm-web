# 成就系统使用指南

## 🏆 系统概述

成就系统为您的CRM提供了完整的游戏化体验，包括：

- **成就系统**：基于业务行为的成就解锁
- **头像框系统**：可装备的头像装饰框
- **勋章系统**：可佩戴的荣誉勋章
- **积分奖励**：成就完成后的积分奖励
- **进度追踪**：实时进度更新和统计

## 🏗️ 系统架构

### 数据库设计

#### 核心表结构

1. **成就定义表** (`achievements`)
   - 定义所有可获得的成就
   - 包含成就要求、奖励等信息

2. **用户成就记录表** (`user_achievements`)
   - 记录用户成就进度
   - 追踪完成状态和奖励发放

3. **头像框表** (`avatar_frames`)
   - 定义可用的头像框样式
   - 支持不同稀有度等级

4. **勋章表** (`badges`)
   - 定义可获得的勋章
   - 包含图标和稀有度信息

5. **用户头像框表** (`user_avatar_frames`)
   - 记录用户解锁的头像框
   - 管理装备状态

6. **用户勋章表** (`user_badges`)
   - 记录用户获得的勋章
   - 管理佩戴状态

### 核心功能

#### 1. 成就分类
- **里程碑成就**：基于数量累积（如完成100个跟进）
- **技能成就**：基于特定技能表现（如转化率>20%）
- **社交成就**：基于团队协作（如帮助同事10次）
- **特殊成就**：基于特殊事件（如首次成交、连续签到30天）

#### 2. 奖励系统
- **积分奖励**：直接积分奖励
- **头像框**：不同风格的头像装饰框
- **勋章**：可佩戴的成就徽章
- **特殊权限**：解锁特殊功能

#### 3. 稀有度系统
- **基础** (Common)：基础成就和奖励
- **稀有** (Rare)：较难获得的成就
- **史诗** (Epic)：高价值成就
- **传说** (Legendary)：最高级别成就

## 🚀 部署步骤

### 1. 数据库部署

```bash
# 连接到您的Supabase数据库
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[gAC5Yqi01wh3eISR]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 执行成就系统部署脚本
\i sql-scripts/achievement-system/create_achievement_system.sql
```

### 2. 前端集成

#### 2.1 导入组件
```typescript
import { AchievementSystem } from '../components/AchievementSystem';
```

#### 2.2 在页面中使用
```typescript
// 完整版成就系统
<AchievementSystem showHeader={true} compact={false} />

// 紧凑版成就系统
<AchievementSystem showHeader={false} compact={true} />
```

### 3. 成就触发器集成

#### 3.1 在业务操作中触发成就
```typescript
import { achievementTriggers } from '../utils/achievementTriggers';

// 跟进完成时触发
await achievementTriggers.onFollowupCompleted(followupData);

// 成交完成时触发
await achievementTriggers.onDealCompleted(dealData);

// 转化率检查
await achievementTriggers.onConversionRateCheck(conversionRate);

// 积分获得时触发
await achievementTriggers.onPointsEarned(pointsEarned, totalPointsEarned);
```

## 📊 成就类型详解

### 1. 里程碑成就

#### 首次跟进 (`first_followup`)
- **要求**：完成1个线索跟进
- **奖励**：50积分 + 青铜头像框 + 新手销售勋章
- **触发**：跟进完成时

#### 跟进达人 (`followup_master`)
- **要求**：完成100个线索跟进
- **奖励**：200积分 + 白银头像框
- **触发**：跟进完成时

#### 首次成交 (`first_deal`)
- **要求**：完成1笔成交
- **奖励**：500积分 + 黄金头像框 + 成交达人勋章
- **触发**：成交完成时

#### 成交大师 (`deal_master`)
- **要求**：完成50笔成交
- **奖励**：1000积分 + 钻石头像框
- **触发**：成交完成时

### 2. 技能成就

#### 转化大师 (`conversion_master`)
- **要求**：转化率达到20%
- **奖励**：300积分 + 转化大师勋章
- **触发**：转化率检查时

#### 积分收集者 (`points_collector`)
- **要求**：累计获得1000积分
- **奖励**：100积分
- **触发**：积分获得时

### 3. 社交成就

#### 团队助手 (`team_helper`)
- **要求**：帮助同事10次
- **奖励**：150积分 + 团队领袖勋章
- **触发**：帮助同事时

### 4. 特殊成就

#### 连续签到 (`daily_checkin`)
- **要求**：连续签到30天
- **奖励**：200积分 + 连续签到勋章
- **触发**：每日签到时

## 🎨 头像框系统

### 头像框类型
- **边框型**：在头像周围添加装饰边框
- **背景型**：为头像添加背景效果
- **覆盖型**：在头像上添加覆盖层

### 稀有度等级
- **基础**：默认头像框
- **稀有**：青铜、白银头像框
- **史诗**：黄金头像框
- **传说**：钻石头像框

### 使用方法
```typescript
// 装备头像框
await achievementApi.equipAvatarFrame(frameId);

// 获取当前装备的头像框
const equippedFrame = getEquippedAvatarFrame();
```

## 🏅 勋章系统

### 勋章类型
- **新手销售**：完成第一个跟进
- **成交达人**：完成第一笔成交
- **转化大师**：转化率达到20%
- **团队领袖**：帮助同事10次
- **连续签到**：连续签到30天

### 使用方法
```typescript
// 佩戴勋章
await achievementApi.equipBadge(badgeId);

// 获取当前佩戴的勋章
const equippedBadge = getEquippedBadge();
```

## 🔧 API 使用

### 1. 获取用户成就
```typescript
const achievements = await achievementApi.getUserAchievements(userId);
```

### 2. 更新成就进度
```typescript
const result = await achievementApi.updateAchievementProgress(
  userId,
  'first_followup',
  1,
  'followup_completed',
  followupData
);
```

### 3. 获取头像框
```typescript
const avatarFrames = await achievementApi.getUserAvatarFrames(userId);
```

### 4. 获取勋章
```typescript
const badges = await achievementApi.getUserBadges(userId);
```

### 5. 获取成就统计
```typescript
const stats = await achievementApi.getAchievementStats(userId);
```

## 🎯 Hook 使用

### 1. 基本使用
```typescript
import { useAchievements } from '../hooks/useAchievements';

const {
  achievements,
  avatarFrames,
  badges,
  stats,
  loading,
  updateProgress,
  equipAvatarFrame,
  equipBadge
} = useAchievements();
```

### 2. 分类获取
```typescript
const {
  getAchievementsByCategory,
  getCompletedAchievements,
  getInProgressAchievements,
  getNotStartedAchievements
} = useAchievements();

// 获取分类成就
const milestoneAchievements = getAchievementsByCategory().milestone;

// 获取已完成的成就
const completedAchievements = getCompletedAchievements();
```

## 🎨 自定义样式

### 1. 成就卡片样式
```css
.achievement-card {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.achievement-card.completed {
  border: 2px solid #52c41a;
}
```

### 2. 头像框样式
```css
.avatar-frame {
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

.avatar-frame.equipped {
  border: 3px solid #1890ff;
}
```

## 🔄 集成示例

### 1. 在跟进页面集成
```typescript
// 跟进完成时触发成就
const handleFollowupComplete = async (followupData) => {
  // 保存跟进数据
  await saveFollowup(followupData);
  
  // 触发成就
  await achievementTriggers.onFollowupCompleted(followupData);
  
  // 显示成功消息
  message.success('跟进完成！');
};
```

### 2. 在成交页面集成
```typescript
// 成交完成时触发成就
const handleDealComplete = async (dealData) => {
  // 保存成交数据
  await saveDeal(dealData);
  
  // 触发成就
  await achievementTriggers.onDealCompleted(dealData);
  
  // 显示成功消息
  message.success('成交完成！');
};
```

### 3. 在积分页面集成
```typescript
// 积分获得时触发成就
const handlePointsEarned = async (pointsEarned, totalPointsEarned) => {
  // 更新积分
  await updatePoints(pointsEarned);
  
  // 触发成就
  await achievementTriggers.onPointsEarned(pointsEarned, totalPointsEarned);
};
```

## 📈 性能优化

### 1. 数据缓存
- 成就数据使用本地缓存
- 定期刷新避免数据过期
- 增量更新减少网络请求

### 2. 批量操作
- 支持批量成就检查
- 减少数据库查询次数
- 优化触发器性能

### 3. 懒加载
- 成就详情按需加载
- 头像框和勋章图片懒加载
- 分页加载大量数据

## 🐛 故障排除

### 1. 成就进度不更新
- 检查用户ID是否正确
- 确认成就代码是否存在
- 验证触发器是否正常调用

### 2. 头像框不显示
- 检查头像框数据是否正确
- 确认CSS样式是否加载
- 验证装备状态是否正确

### 3. 勋章不显示
- 检查勋章数据是否正确
- 确认图标是否正确显示
- 验证佩戴状态是否正确

## 🎉 总结

成就系统为您的CRM提供了完整的游戏化体验，通过：

1. **激励用户**：通过成就和奖励激励用户积极参与
2. **提升体验**：通过头像框和勋章提升用户个性化体验
3. **数据驱动**：通过成就统计了解用户行为
4. **社交互动**：通过社交成就促进团队协作

系统设计灵活，易于扩展，可以根据业务需求添加新的成就类型和奖励机制。 