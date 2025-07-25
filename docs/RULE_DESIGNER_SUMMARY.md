# 画板式规则设计器功能总结

## 🎯 核心功能概述

画板式规则设计器是一个基于Agent工作流模式的可视化规则配置工具，专为线索分配系统设计。通过拖拽卡片、连接节点的方式，直观地构建复杂的分配逻辑。

## 📦 主要组件

### 1. 基础画板设计器 (RuleDesigner.tsx)
- **功能**：基础的画板设计功能
- **特点**：简单易用，适合入门用户
- **节点类型**：触发条件、执行动作、输出结果

### 2. 增强画板设计器 (EnhancedRuleDesigner.tsx)
- **功能**：完整的画板设计功能
- **特点**：功能丰富，适合高级用户
- **节点类型**：触发条件、执行动作、输出结果、条件判断、循环控制

## 🎨 界面设计

### 工具栏功能
```
左侧工具栏：
├── 添加节点
│   ├── 触发条件
│   ├── 执行动作
│   ├── 输出结果
│   ├── 条件判断
│   └── 循环控制
├── 画布操作
│   ├── 保存
│   ├── 预览
│   ├── 测试
│   ├── 撤销
│   ├── 重做
│   └── 清空
├── 视图控制
│   ├── 放大
│   ├── 缩小
│   ├── 全屏
│   ├── 帮助
│   ├── 导出
│   └── 导入
└── 搜索过滤
    ├── 搜索框
    ├── 类型过滤
    ├── 排序功能
    └── 统计信息
```

### 画布功能
```
画布操作：
├── 拖拽移动节点
├── 调整节点大小
├── 缩放画布视图
├── 选择节点和连接
├── 创建连接关系
├── 编辑连接属性
└── 删除节点和连接
```

## 🔧 节点类型详解

### 1. 触发条件节点 (蓝色)
- **用途**：定义何时触发规则
- **类型**：
  - 渠道触发：抖音、小红书、微信等
  - 社区触发：北虹桥、徐汇等
  - 时间触发：工作时间、非工作时间
  - 用户触发：特定用户或用户组
  - 预算触发：基于预算限制
  - 自定义触发：用户自定义条件

### 2. 执行动作节点 (绿色)
- **用途**：执行具体的分配动作
- **类型**：
  - 分配用户：直接分配给指定用户
  - 角色分配：按角色进行分配
  - 积分扣减：扣减用户积分
  - 负载均衡：按工作量分配
  - 轮询分配：轮流分配给用户
  - 通知发送：发送分配通知
  - 自定义动作：用户自定义动作

### 3. 输出结果节点 (紫色)
- **用途**：规则执行的结果
- **类型**：
  - 分配完成：成功分配
  - 分配失败：分配失败
  - 等待处理：等待进一步处理
  - 兜底处理：进入兜底流程

### 4. 条件判断节点 (橙色)
- **用途**：条件分支判断
- **类型**：
  - 积分检查：检查用户积分
  - 工作量检查：检查用户工作量
  - 时间检查：检查时间条件
  - 自定义条件：用户自定义条件

### 5. 循环控制节点 (粉色)
- **用途**：循环执行逻辑
- **类型**：
  - While循环：条件循环
  - For循环：次数循环
  - 自定义循环：用户自定义循环

## 🔗 连接功能

### 连接类型
- **成功连接**：条件满足时的连接
- **失败连接**：条件不满足时的连接
- **默认连接**：默认的连接路径

### 连接样式
- **实线**：默认连接样式
- **虚线**：条件连接样式
- **点线**：可选连接样式

### 连接属性
- **标签**：连接说明文字
- **条件**：连接触发条件
- **颜色**：连接线颜色
- **粗细**：连接线粗细

## 🛠️ 高级功能

### 1. 搜索和过滤
- **关键词搜索**：搜索节点名称和描述
- **类型过滤**：按节点类型过滤
- **排序功能**：按时间、优先级等排序
- **统计信息**：显示节点和连接数量

### 2. 历史记录
- **撤销功能**：撤销上一步操作
- **重做功能**：重做上一步操作
- **历史记录**：保存操作历史
- **版本控制**：支持规则版本管理

### 3. 导入导出
- **导出功能**：导出规则为JSON格式
- **导入功能**：从JSON文件导入规则
- **模板功能**：支持规则模板
- **备份恢复**：支持规则备份和恢复

### 4. 预览和测试
- **预览功能**：预览规则流程图
- **测试功能**：测试规则执行
- **调试功能**：调试规则逻辑
- **性能分析**：分析规则性能

## 📊 数据结构

### 节点数据结构
```typescript
interface RuleNode {
  id: string;                    // 节点唯一标识
  type: 'trigger' | 'action' | 'output' | 'condition' | 'loop';
  title: string;                 // 节点名称
  description: string;           // 节点描述
  x: number;                     // X坐标
  y: number;                     // Y坐标
  width: number;                 // 宽度
  height: number;                // 高度
  config: any;                   // 节点配置
  connections: string[];         // 连接列表
  enabled: boolean;              // 是否启用
  priority: number;              // 优先级
  color?: string;                // 节点颜色
  icon?: string;                 // 节点图标
  tags?: string[];               // 标签列表
  notes?: string;                // 备注信息
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

### 连接数据结构
```typescript
interface Connection {
  id: string;                    // 连接唯一标识
  from: string;                  // 源节点ID
  to: string;                    // 目标节点ID
  label?: string;                // 连接标签
  condition?: string;            // 连接条件
  type?: 'success' | 'failure' | 'default';
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;                // 连接颜色
  weight?: number;               // 连接粗细
}
```

## 🎯 使用场景

### 1. 简单分配场景
- **适用**：单一渠道、单一策略
- **节点**：触发条件 → 执行动作 → 输出结果
- **示例**：抖音渠道积分分配

### 2. 复杂分配场景
- **适用**：多渠道、多策略
- **节点**：多个触发条件 → 条件判断 → 多个执行动作 → 多个输出结果
- **示例**：多渠道智能分配

### 3. 智能分配场景
- **适用**：基于多维度因素
- **节点**：智能触发 → 多维度检查 → 智能分配 → 结果输出
- **示例**：基于积分、工作量、绩效的智能分配

### 4. 动态分配场景
- **适用**：实时调整策略
- **节点**：动态触发 → 实时检查 → 动态调整 → 实时输出
- **示例**：根据实时负载动态分配

## 📈 性能优化

### 1. 节点数量控制
- 单个规则不超过20个节点
- 复杂逻辑拆分为多个规则
- 使用子流程简化设计

### 2. 连接优化
- 避免循环连接
- 减少不必要的连接
- 使用条件连接减少分支

### 3. 配置优化
- 合理设置优先级
- 优化条件判断顺序
- 使用缓存机制

## 🔒 安全特性

### 1. 数据验证
- 节点配置验证
- 连接关系验证
- 循环检测

### 2. 权限控制
- 用户权限检查
- 操作权限验证
- 数据访问控制

### 3. 错误处理
- 异常捕获
- 错误提示
- 自动恢复

## 🚀 扩展能力

### 1. 自定义节点
- 支持自定义节点类型
- 支持自定义节点配置
- 支持自定义节点样式

### 2. 插件系统
- 支持第三方插件
- 支持自定义插件
- 支持插件市场

### 3. API接口
- 提供RESTful API
- 支持WebSocket实时通信
- 支持事件驱动架构

## 📚 文档资源

### 1. 使用指南
- `RULE_DESIGNER_GUIDE.md`：详细使用指南
- `RULE_DESIGNER_EXAMPLES.md`：使用示例
- `RULE_DESIGNER_DEMO_SCRIPT.md`：演示脚本

### 2. 技术文档
- 组件API文档
- 数据结构说明
- 性能优化指南

### 3. 最佳实践
- 设计原则
- 开发建议
- 常见问题解决

## 🎉 总结

画板式规则设计器为线索分配系统提供了：

1. **直观的可视化设计**：通过拖拽卡片的方式设计规则
2. **Agent工作流模式**：触发条件 → 执行动作 → 输出结果
3. **丰富的节点类型**：支持5种主要节点类型
4. **灵活的连接方式**：支持多种连接类型和样式
5. **强大的工具功能**：搜索、过滤、预览、测试、导入导出等
6. **完善的扩展能力**：支持自定义节点、插件系统、API接口

通过这些功能，用户可以轻松创建和管理复杂的线索分配规则，大大提升了系统的灵活性和易用性。 