# 版本号显示组件使用指南

## 功能概述

`VersionDisplay` 组件是一个智能的版本号显示组件，可以显示当前应用版本、检测版本更新，并提供缓存刷新功能。

## 组件特性

### 1. 动态版本号显示
- 自动从缓存管理器获取当前版本号
- 支持版本更新检测
- 显示版本更新提示

### 2. 多种显示模式
- **简单模式**: 只显示版本号
- **详细信息模式**: 显示版本号 + 更新提示图标
- **标签模式**: 以Tag形式显示
- **带刷新按钮模式**: 包含缓存刷新功能

### 3. 交互功能
- 鼠标悬停显示详细版本信息
- 支持点击刷新缓存
- 版本更新时显示视觉提示

## 使用方法

### 1. 基础用法

```tsx
import VersionDisplay from './components/VersionDisplay';

// 简单显示版本号
<VersionDisplay />

// 自定义样式
<VersionDisplay 
  style={{ 
    color: '#666', 
    fontSize: 14,
    fontWeight: 'bold'
  }} 
/>
```

### 2. 详细信息模式

```tsx
// 显示详细信息（版本号 + 更新提示图标）
<VersionDisplay 
  showDetails={true}
  style={{ color: '#bbb', fontSize: 12 }}
/>
```

### 3. 标签模式

```tsx
// 以Tag形式显示
<VersionDisplay 
  asTag={true}
  showRefreshButton={true}
/>
```

### 4. 带刷新按钮模式

```tsx
// 显示刷新按钮
<VersionDisplay 
  showDetails={true}
  showRefreshButton={true}
  onRefresh={() => {
    console.log('用户点击了刷新按钮');
    // 自定义刷新逻辑
  }}
/>
```

## 组件属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `style` | `React.CSSProperties` | - | 自定义样式 |
| `asTag` | `boolean` | `false` | 是否以Tag形式显示 |
| `showDetails` | `boolean` | `false` | 是否显示详细信息 |
| `showRefreshButton` | `boolean` | `false` | 是否显示刷新按钮 |
| `onRefresh` | `() => void` | - | 刷新按钮点击回调 |

## 显示内容

### 版本号格式
- 显示格式: `v{版本号}`
- 示例: `v1.0.0`

### 工具提示内容
鼠标悬停时显示：
- 当前版本
- 存储版本
- 最后更新时间
- 版本更新提示（如果有更新）

### 视觉提示
- **正常状态**: 默认颜色显示
- **有更新**: 橙色显示，带信息图标
- **悬停状态**: 颜色变化，显示交互提示

## 使用场景

### 1. 导航菜单
```tsx
// 在侧边导航菜单底部显示
<VersionDisplay 
  style={{ 
    color: '#bbb', 
    fontSize: 12 
  }}
  showDetails={true}
  showRefreshButton={true}
/>
```

### 2. 页面底部
```tsx
// 在页面底部显示
<VersionDisplay 
  asTag={true}
  style={{ marginTop: 16 }}
/>
```

### 3. 设置页面
```tsx
// 在设置页面显示版本信息
<VersionDisplay 
  showDetails={true}
  showRefreshButton={true}
  onRefresh={() => {
    message.success('缓存已刷新');
  }}
/>
```

### 4. 移动端
```tsx
// 移动端适配
<VersionDisplay 
  style={{ 
    fontSize: 10,
    color: '#999'
  }}
  showDetails={true}
/>
```

## 集成示例

### 在现有组件中集成

```tsx
import React from 'react';
import { Layout, Space } from 'antd';
import VersionDisplay from './components/VersionDisplay';

const MyComponent: React.FC = () => {
  return (
    <Layout.Footer style={{ textAlign: 'center' }}>
      <Space>
        <span>© 2024 VLINKER-CRM</span>
        <VersionDisplay asTag={true} />
      </Space>
    </Layout.Footer>
  );
};
```

### 在用户菜单中集成

```tsx
import React from 'react';
import { Dropdown, Space } from 'antd';
import VersionDisplay from './components/VersionDisplay';

const UserMenu: React.FC = () => {
  const items = [
    {
      key: 'version',
      label: (
        <Space>
          <span>版本信息</span>
          <VersionDisplay asTag={true} />
        </Space>
      ),
    },
    // 其他菜单项...
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight">
      <Button>用户菜单</Button>
    </Dropdown>
  );
};
```

## 自定义样式

### 1. 基础样式定制

```tsx
<VersionDisplay 
  style={{
    color: '#1890ff',
    fontSize: 14,
    fontWeight: 'bold',
    padding: '4px 8px',
    borderRadius: 4,
    backgroundColor: '#f0f8ff'
  }}
/>
```

### 2. 响应式样式

```tsx
<VersionDisplay 
  style={{
    fontSize: window.innerWidth < 768 ? 10 : 12,
    color: '#666'
  }}
/>
```

### 3. 主题适配

```tsx
// 深色主题
<VersionDisplay 
  style={{
    color: '#fff',
    backgroundColor: '#001529',
    padding: '2px 6px',
    borderRadius: 3
  }}
  asTag={true}
/>
```

## 最佳实践

### 1. 位置选择
- **导航菜单**: 放在菜单底部，不占用主要空间
- **页面底部**: 作为页脚信息显示
- **设置页面**: 作为系统信息展示
- **用户菜单**: 作为用户相关信息

### 2. 功能配置
- **开发环境**: 启用刷新按钮，便于调试
- **生产环境**: 可选择性启用刷新按钮
- **移动端**: 简化显示，减少交互元素

### 3. 用户体验
- 提供清晰的版本信息
- 版本更新时给出明确提示
- 刷新操作有确认机制
- 保持界面简洁不干扰主要功能

## 注意事项

1. **版本号更新**: 确保在 `cacheManager.ts` 中正确更新版本号
2. **缓存刷新**: 刷新操作会清除所有缓存并重新加载页面
3. **权限控制**: 刷新功能可能需要特定权限
4. **移动端适配**: 在小屏幕上注意字体大小和间距
5. **性能考虑**: 避免在频繁渲染的组件中使用复杂配置

## 故障排除

### 1. 版本号不显示
- 检查 `cacheManager` 是否正确初始化
- 确认版本号配置是否正确

### 2. 更新提示不显示
- 检查版本号是否已更新
- 确认缓存是否已清除

### 3. 刷新按钮不工作
- 检查 `onRefresh` 回调是否正确设置
- 确认缓存管理器是否正常工作

通过这个组件，您可以轻松地在应用的任何位置显示动态版本号，并提供版本更新检测和缓存刷新功能。
