# 倒计时组件日志功能指南

## 📋 概述

已为倒计时组件添加了详细的日志记录功能，包括会话超时警告组件和相关的 hook。这些日志将帮助开发者调试和监控倒计时功能的行为。

## 🔧 修改的文件

### 1. `src/components/SessionTimeoutWarning.tsx`
- 添加了倒计时事件日志记录
- 记录关键时间点的警告（30秒、10秒、5秒）
- 记录用户操作（延长会话、主动登出）
- 记录组件生命周期事件

### 2. `src/hooks/useSessionTimeout.ts`
- 添加了会话超时管理日志
- 记录用户活动检测
- 记录会话状态检查
- 记录警告显示/隐藏事件

## 📊 日志类型和内容

### SessionTimeoutWarning 组件日志

#### 倒计时相关日志
```javascript
🕐 [SessionTimeoutWarning] 倒计时开始
🕐 [SessionTimeoutWarning] 30秒警告
🕐 [SessionTimeoutWarning] 10秒警告
🕐 [SessionTimeoutWarning] 5秒警告
🕐 [SessionTimeoutWarning] 倒计时结束 - 自动登出
```

#### 用户操作日志
```javascript
🕐 [SessionTimeoutWarning] 用户点击延长会话
🕐 [SessionTimeoutWarning] 会话延长成功
🕐 [SessionTimeoutWarning] 会话延长失败
🕐 [SessionTimeoutWarning] 用户主动登出
```

#### 组件生命周期日志
```javascript
🕐 [SessionTimeoutWarning] 倒计时停止 - 组件不可见
🕐 [SessionTimeoutWarning] 倒计时重置
🕐 [SessionTimeoutWarning] 倒计时清理 - 组件卸载或重新渲染
```

### useSessionTimeout Hook 日志

#### 初始化和清理日志
```javascript
⏰ [useSessionTimeout] useSessionTimeout 初始化
⏰ [useSessionTimeout] useSessionTimeout 清理
```

#### 会话管理日志
```javascript
⏰ [useSessionTimeout] 重置会话超时
⏰ [useSessionTimeout] 会话超时触发
⏰ [useSessionTimeout] 用户活动检测
⏰ [useSessionTimeout] 隐藏会话警告
```

#### 状态检查日志
```javascript
⏰ [useSessionTimeout] 会话状态检查
⏰ [useSessionTimeout] 显示会话警告
⏰ [useSessionTimeout] 会话超时检查通过
```

## 🔍 日志数据结构

每个日志条目包含以下信息：

```javascript
{
  timestamp: "2024-01-20T10:30:00.000Z",  // ISO 时间戳
  timeRemaining: 300000,                  // 剩余时间（毫秒）
  countdown: 290000,                      // 当前倒计时值
  isVisible: true,                        // 组件是否可见
  action: "extend_session",               // 操作类型
  // ... 其他相关数据
}
```

## 🛠️ 如何使用日志

### 1. 开发环境
日志只在开发环境（`NODE_ENV === 'development'`）中输出，不会影响生产环境性能。

### 2. 查看日志
在浏览器开发者工具的控制台中查看日志：

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签页
3. 触发倒计时相关操作
4. 查看以 `🕐` 和 `⏰` 开头的日志条目

### 3. 日志过滤
可以使用浏览器控制台的过滤功能：

- 过滤 `[SessionTimeoutWarning]` 查看组件相关日志
- 过滤 `[useSessionTimeout]` 查看 hook 相关日志
- 过滤特定操作类型，如 `extend_session`、`logout` 等

## 📈 监控和调试

### 常见问题调试

#### 1. 倒计时不准确
查看日志中的时间计算：
```javascript
⏰ [useSessionTimeout] 会话状态检查 {
  timeSinceLastActivity: 120000,
  timeRemaining: 180000,
  warningThresholdMs: 300000
}
```

#### 2. 警告不显示
检查警告显示条件：
```javascript
⏰ [useSessionTimeout] 显示会话警告 {
  timeRemaining: 240000,
  warningThresholdMs: 300000,
  action: "show_warning"
}
```

#### 3. 用户活动检测问题
查看活动检测日志：
```javascript
⏰ [useSessionTimeout] 用户活动检测 {
  timeSinceLastActivity: 5000,
  wasWarningShown: true,
  action: "user_activity"
}
```

### 性能监控

日志记录使用了以下优化：
- 只在开发环境输出
- 使用节流机制避免频繁日志
- 关键时间点才记录详细日志
- 自动清理定时器避免内存泄漏

## 🔧 自定义日志

如需添加更多日志点，可以：

1. 在组件中添加 `logCountdownEvent` 调用
2. 在 hook 中添加 `logSessionEvent` 调用
3. 根据需要调整日志级别和内容

## 📝 注意事项

1. **生产环境**：日志不会在生产环境输出，确保性能
2. **内存管理**：所有定时器都有正确的清理机制
3. **错误处理**：日志记录不会影响主要功能逻辑
4. **兼容性**：日志功能不影响现有功能的使用

## 🚀 未来改进

可以考虑的改进方向：
1. 添加日志级别控制（debug、info、warn、error）
2. 集成到外部日志系统
3. 添加性能指标统计
4. 支持日志导出和分析
