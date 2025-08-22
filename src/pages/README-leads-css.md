# 线索相关页面统一样式文件

## 概述

`leads-common.css` 是为线索相关的4个页面创建的统一样式文件，确保所有页面具有一致的外观和用户体验。

## 适用页面

- **线索列表** (`LeadsList.tsx`)
- **跟进记录** (`FollowupsGroupList.tsx`)
- **带看记录** (`ShowingsList.tsx`)
- **成交记录** (`DealsList.tsx`)
- **移动端跟进记录** (`FollowupsGroupListMobile.tsx`)

## 使用方法

在每个页面文件的顶部添加以下导入语句：

```tsx
import './leads-common.css';
```

## 包含的样式类别

### 1. 页面基础样式
- `.page-card` - 页面卡片容器
- `.page-header` - 页面头部区域
- `.page-search` - 搜索框样式
- `.page-btn` - 按钮样式
- `.page-table-wrap` - 表格容器
- `.page-table` - 表格样式

### 2. 表格样式
- `.compact-table` - 紧凑表格样式
- `.compact-table-row` - 表格行样式
- 表格头部、主体、筛选、排序等样式

### 3. 分组面板样式
- `.main-flex-layout` - 主布局容器
- `.group-panel-sidebar` - 分组侧边栏
- `.group-btn` - 分组按钮
- `.quick-date-bar` - 快捷日期栏

### 4. 抽屉和弹窗样式
- `.lead-detail-drawer` - 线索详情抽屉
- `.page-modal` - 页面弹窗
- `.drawer-flex-row` - 抽屉内容布局

### 5. 表单样式
- `.page-step-fields` - 步骤字段布局
- `.form-content` - 表单内容区域
- `.button-group` - 按钮组

### 6. 筛选和标签样式
- `.filter-tag` - 筛选标签
- `.custom-filter-card` - 自定义筛选卡片
- `.filter-section` - 筛选区域

### 7. Ant Design 组件样式优化
- 按钮、输入框、选择器、日期选择器等组件的统一样式
- 颜色主题、圆角、阴影等视觉优化

### 8. 响应式设计
- 移动端适配样式
- 不同屏幕尺寸的布局调整

### 9. 工具类样式
- `.mb-12` - 下边距
- `.text-secondary` - 次要文本
- `.text-primary` - 主要文本
- `.text-muted` - 静默文本

## 样式特点

1. **统一性** - 所有页面使用相同的设计语言
2. **现代化** - 采用圆角、阴影等现代设计元素
3. **响应式** - 支持不同屏幕尺寸
4. **可维护性** - 集中管理，便于统一修改
5. **性能优化** - 避免重复的样式定义

## 自定义样式

如果需要为特定页面添加自定义样式，可以：

1. 在页面组件中添加内联样式
2. 创建页面特定的CSS文件（如 `LeadsList-custom.css`）
3. 在统一CSS文件中添加新的样式类

## 注意事项

1. 确保在页面组件中正确导入此CSS文件
2. 避免在页面组件中重复定义已在统一CSS中的样式
3. 修改统一CSS时需要考虑所有使用该文件的页面
4. 新增样式时保持与现有样式的一致性

## 更新历史

- 创建统一的CSS文件，整合所有线索相关页面的样式
- 删除不再使用的CSS文件（`compact-table.css`、`FollowupsGroupList.css`、`FollowupsGroupListMobile.css`）
- 更新所有相关页面的CSS引用
