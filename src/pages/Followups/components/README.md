# 跟进阶段抽屉组件

## 概述

为新跟进记录页面增加了通用的抽屉编辑组件，参考旧跟进记录页面的实现方式。主要包含以下组件：

## 文件结构

```
src/pages/Followups/components/
├── FollowupStageDrawer.tsx      # 主抽屉组件
├── FollowupStageForm.tsx        # 表单组件
├── FollowupStageDrawer.css      # 样式文件
└── README.md                    # 说明文档
```

## 主要组件

### 1. FollowupStageDrawer.tsx

主要的抽屉组件，包含以下功能：

- **线索信息展示**: 左侧展示线索的基本信息（线索编号、手机号、微信号、渠道、创建时间）
- **阶段步骤条**: 右侧显示跟进阶段的步骤进度
- **表单编辑**: 集成表单组件，支持不同阶段的字段编辑
- **数据保存**: 支持表单验证和数据保存到数据库

#### 主要属性:

```typescript
interface FollowupStageDrawerProps {
  open: boolean;                           // 抽屉开关状态
  onClose: () => void;                     // 关闭回调
  record: FollowupRecord | null;           // 当前编辑的记录
  onSave?: (record, updatedFields) => void; // 保存回调
  isFieldDisabled?: () => boolean;         // 字段禁用检查
  forceUpdate?: number;                    // 强制更新标记
  // 枚举数据选项
  communityEnum: any[];
  followupstageEnum: any[];
  customerprofileEnum: any[];
  userratingEnum: any[];
  majorCategoryOptions: any[];
  metroStationOptions: any[];
}
```

### 2. FollowupStageForm.tsx

表单组件，负责具体的字段渲染和编辑：

- **字段配置**: 根据不同阶段显示对应的表单字段
- **动态布局**: 支持单栏和双栏布局，根据阶段自动切换
- **字段类型**: 支持选择器、级联选择器、日期选择器、数字输入等多种字段类型
- **表单验证**: 内置必填字段验证

#### 支持的阶段和字段:

```typescript
const stageFields = {
  '待接收': ['followupstage'],
  '确认需求': ['followupstage', 'customerprofile', 'userrating', 'scheduledcommunity', 'worklocation', 'userbudget', 'moveintime'],
  '邀约到店': ['followupstage', 'scheduletime', 'majorcategory', 'remark'],
  '已到店': ['followupstage', 'majorcategory', 'remark'],
  '赢单': ['followupstage', 'majorcategory', 'remark'],
  '丢单': ['followupstage', 'majorcategory', 'remark'],
};
```

### 3. FollowupStageDrawer.css

样式文件，提供：

- **抽屉布局样式**: flex 布局，左右分栏
- **信息面板样式**: 左侧线索信息的展示样式
- **表单样式**: 单栏和双栏表单布局
- **滚动条样式**: 自定义滚动条外观
- **响应式样式**: 移动端适配

## 使用方法

### 1. 在主页面中导入组件

```typescript
import { FollowupStageDrawer } from './components/FollowupStageDrawer';
```

### 2. 添加状态管理

```typescript
const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
const [currentEditRecord, setCurrentEditRecord] = useState(null);
```

### 3. 实现事件处理

```typescript
// 处理阶段点击
const handleStageClick = (record) => {
  setCurrentEditRecord(record);
  setStageDrawerOpen(true);
};

// 处理保存
const handleStageDrawerSave = (record, updatedFields) => {
  // 更新本地数据
  optimizedLocalData.updateMultipleFields(record.id, updatedFields);
  // 刷新数据
  const currentFilters = filterManager.getCurrentFiltersFn();
  followupsData.refreshData(currentFilters);
};

// 处理关闭
const handleStageDrawerClose = () => {
  setStageDrawerOpen(false);
  setCurrentEditRecord(null);
};
```

### 4. 在 JSX 中使用

```tsx
<FollowupStageDrawer
  open={stageDrawerOpen}
  onClose={handleStageDrawerClose}
  record={currentEditRecord}
  onSave={handleStageDrawerSave}
  isFieldDisabled={frequencyControl.isFieldDisabled}
  forceUpdate={followupsData.forceUpdate}
  communityEnum={enumData.communityEnum}
  followupstageEnum={enumData.followupstageEnum}
  customerprofileEnum={enumData.customerprofileEnum}
  userratingEnum={enumData.userratingEnum}
  majorCategoryOptions={enumData.majorCategoryOptions}
  metroStationOptions={enumData.metroStationOptions}
/>
```

## 特性

### 1. 数据脱敏
- 手机号显示为 `139****8888` 格式
- 微信号显示为 `abc***xyz` 格式
- 支持一键复制完整信息

### 2. 表单验证
- 必填字段验证
- 日期格式自动处理
- 级联选择器路径查找

### 3. 响应式设计
- 移动端友好的布局
- 自适应滚动区域
- 优化的触摸体验

### 4. 性能优化
- 表单字段按需渲染
- 防抖处理
- 乐观更新策略

## 集成说明

该抽屉组件已完全集成到新的跟进记录页面 (`src/pages/Followups/index.tsx`) 中，通过点击表格中的跟进阶段按钮即可打开编辑抽屉。

## 注意事项

1. 确保传入正确的枚举数据，否则下拉选项可能为空
2. `isFieldDisabled` 函数用于频率控制，确保用户操作不过于频繁
3. 保存成功后会自动刷新相关数据，包括明细表和分组统计
4. 所有日期字段都会自动转换为 dayjs 对象进行处理

