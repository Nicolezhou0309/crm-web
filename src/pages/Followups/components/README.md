# Followups 组件说明

## CustomerCard 长按菜单功能

### 功能概述
CustomerCard 组件现在支持长按触发上下文菜单，提供以下功能：

1. **复制电话** - 复制客户电话号码到剪贴板
2. **复制微信** - 复制客户微信号到剪贴板  
3. **回退线索** - 将线索回退到上一个阶段

### 触发方式

#### 移动端
- **长按卡片** 500ms 后触发菜单
- 触摸移动会取消长按触发

#### 桌面端
- **右键点击** 卡片触发菜单
- 支持鼠标右键菜单

### 使用方法

```tsx
import { CustomerCard } from './components/CustomerCard';

// 在组件中使用
<CustomerCard
  record={record}
  onEdit={handleCardEdit}
  onRollback={handleLeadRollback} // 新增的回退回调
/>
```

### 回调函数

#### onRollback(record: any)
当用户选择"回退线索"时触发，需要实现实际的回退逻辑：

```tsx
const handleLeadRollback = useCallback(async (record: any) => {
  try {
    // 调用回退API
    await rollbackLead(record.id);
    message.success('线索回退成功');
    // 刷新数据
    refreshData();
  } catch (error) {
    message.error('线索回退失败');
  }
}, []);
```

### 样式定制

菜单样式可以通过修改 `CardContextMenu.css` 文件进行定制：

- 菜单外观：背景色、圆角、阴影
- 菜单项：间距、字体、图标
- 动画效果：显示/隐藏动画
- 响应式：移动端和桌面端适配

### 注意事项

1. 长按触发时间设置为500ms，可根据需要调整
2. 触摸移动会取消长按，避免误触
3. 菜单会自动定位到触摸/点击位置
4. 点击外部区域会自动关闭菜单
5. 回退操作需要确认对话框，防止误操作

