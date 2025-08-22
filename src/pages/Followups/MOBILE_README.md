# 手机端Followups页面

## 功能概述

这是一个专为手机端设计的客户跟进页面，采用卡片式UI设计，提供更好的移动端用户体验。

## 主要特性

### ✅ 保留功能
- **客户信息展示**: 以卡片形式展示客户基本信息
- **搜索功能**: 支持按客户姓名、电话、备注等关键词搜索
- **筛选功能**: 支持按跟进阶段、意向社区、客户等级、来源等条件筛选
- **编辑功能**: 点击卡片编辑按钮，调用抽屉视图进行编辑
- **自动保存**: 集成现有的自动保存系统
- **响应式设计**: 适配不同尺寸的手机屏幕

### ❌ 移除功能
- **分组统计**: 取消分组统计面板
- **入住日历**: 取消日历视图功能
- **回退列表**: 取消回退申请列表功能

## 技术实现

### 组件结构
```
MobileFollowups/
├── mobile.tsx          # 主组件文件
├── mobile.css          # 样式文件
└── MOBILE_README.md    # 说明文档
```

### 核心Hook使用
- `useFollowupsData`: 数据获取和管理
- `useFilterManager`: 筛选条件管理
- `useEnumData`: 枚举数据管理
- `useFrequencyControl`: 频率控制
- `useAutoSave`: 自动保存功能
- `useOptimizedLocalData`: 本地数据优化

### UI组件
- **Ant Design组件**: Card, Avatar, Tag, Drawer, Search等
- **自定义样式**: 卡片式布局，移动端优化
- **图标系统**: 使用Ant Design图标库

## 使用方法

### 1. 导入组件
```tsx
import MobileFollowups from './pages/Followups/mobile';
```

### 2. 在路由中使用
```tsx
<Route path="/followups/mobile" element={<MobileFollowups />} />
```

### 3. 作为子组件使用
```tsx
<MobileFollowups className="custom-mobile-followups" />
```

## 样式定制

### CSS类名
- `.mobile-followups`: 主容器
- `.mobile-customer-card`: 客户卡片
- `.card-header`: 卡片头部
- `.card-content`: 卡片内容
- `.customer-info`: 客户信息区域
- `.customer-tags`: 标签区域

### 响应式断点
- `max-width: 480px`: 小屏手机
- `max-width: 360px`: 超小屏手机

### 深色模式
自动检测系统深色模式偏好，提供相应的样式支持。

## 性能优化

### 数据管理
- 使用`useMemo`优化数据计算
- 集成现有的数据缓存机制
- 支持乐观更新

### 渲染优化
- 虚拟滚动支持（大数据量时）
- 懒加载图片和组件
- 防抖搜索输入

## 兼容性

### 浏览器支持
- iOS Safari 12+
- Android Chrome 70+
- 现代移动端浏览器

### 设备支持
- 手机（竖屏/横屏）
- 平板（竖屏/横屏）
- 小屏桌面设备

## 开发说明

### 状态管理
- 使用React Hooks管理本地状态
- 集成现有的全局状态管理
- 支持状态持久化

### 错误处理
- 网络错误重试机制
- 用户友好的错误提示
- 降级处理方案

### 测试建议
- 移动端设备测试
- 不同屏幕尺寸测试
- 触摸操作测试
- 网络状况测试

## 未来扩展

### 可能的功能增强
- 下拉刷新
- 无限滚动
- 离线支持
- 推送通知
- 手势操作

### 性能提升
- 图片懒加载
- 组件懒加载
- 数据预加载
- 缓存策略优化
