# Tailwind CSS 集成指南

## 概述
本项目已成功集成 Tailwind CSS，可以与现有的 Ant Design 组件库配合使用。

## 安装的依赖
- `tailwindcss`: Tailwind CSS 核心库
- `postcss`: CSS 后处理器
- `autoprefixer`: 自动添加 CSS 前缀

## 配置文件
- `tailwind.config.js`: Tailwind CSS 配置
- `postcss.config.js`: PostCSS 配置
- `src/index.css`: 包含 Tailwind 指令

## 使用方法

### 1. 基本类名
```tsx
// 布局
<div className="flex items-center justify-between p-4">
  <div className="text-left">左侧内容</div>
  <div className="text-right">右侧内容</div>
</div>

// 颜色和背景
<div className="bg-blue-500 text-white p-4 rounded-lg">
  蓝色背景卡片
</div>

// 响应式设计
<div className="w-full md:w-1/2 lg:w-1/3">
  响应式宽度
</div>
```

### 2. 与 Ant Design 结合使用
```tsx
import { Button, Card } from 'antd';

// 使用 Tailwind 自定义 Ant Design 组件样式
<Card className="shadow-lg hover:shadow-xl transition-shadow">
  <div className="p-6">
    <h3 className="text-xl font-bold text-gray-800 mb-4">
      自定义标题样式
    </h3>
    <Button className="bg-blue-600 hover:bg-blue-700 border-blue-600">
      自定义按钮
    </Button>
  </div>
</Card>
```

### 3. 常用工具类组合

#### 卡片样式
```tsx
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  卡片内容
</div>
```

#### 按钮样式
```tsx
<button className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors">
  按钮
</button>
```

#### 表单样式
```tsx
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      标签
    </label>
    <input className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
  </div>
</div>
```

## 测试
访问 `/tailwind-test` 路由查看 Tailwind CSS 是否正常工作。

## 注意事项
1. Tailwind CSS 类名优先级低于 Ant Design 的内联样式
2. 可以使用 `!important` 修饰符（如 `!bg-red-500`）来覆盖样式
3. 建议优先使用 Tailwind 进行布局和间距调整
4. 复杂组件样式仍建议使用 Ant Design 的内置样式

## 自定义配置
如需自定义 Tailwind CSS 主题，请编辑 `tailwind.config.js` 文件。
