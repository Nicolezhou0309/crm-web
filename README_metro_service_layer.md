# 上海地铁计算器 - 服务层架构

## 🏗️ 架构概述

本项目采用分层架构设计，将地铁距离计算逻辑抽象为服务层，提高了代码的可维护性、可测试性和可扩展性。

## 📁 服务层结构

```
src/services/
├── index.ts                    # 服务层统一导出
├── MetroService.ts            # 核心地铁服务
├── MetroConfigService.ts      # 配置管理服务
├── MetroCacheService.ts       # 缓存服务
└── MetroServiceCoordinator.ts # 服务协调器
```

## 🔧 核心服务

### 1. MetroService (核心地铁服务)

**职责**: 封装所有地铁相关的计算逻辑和业务规则

**主要功能**:
- 通勤信息计算
- 站点查找和搜索
- 线路信息管理
- 换乘站点检测
- 路线规划算法

**设计模式**: 单例模式

```typescript
// 使用示例
const metroService = MetroService.getInstance();
const result = metroService.calculateCommute('莘庄', '人民广场');
```

### 2. MetroConfigService (配置管理服务)

**职责**: 管理地铁计算相关的配置参数

**配置项**:
- 时间配置（每站时间、换乘时间）
- 距离配置（距离倍数、平均站点间距）
- 搜索配置（最大结果数、超时时间）
- 缓存配置（是否启用、过期时间）
- 性能配置（最大换乘尝试、并行搜索）

**设计模式**: 单例模式

```typescript
// 使用示例
const configService = MetroConfigService.getInstance();
const timePerStation = configService.get('timePerStation');
configService.set('timePerStation', 4);
```

### 3. MetroCacheService (缓存服务)

**职责**: 提供计算结果缓存功能，提高性能

**主要功能**:
- 通勤结果缓存
- 缓存过期管理
- 缓存统计信息
- 预加载常用路线
- 批量缓存操作

**设计模式**: 单例模式

```typescript
// 使用示例
const cacheService = MetroCacheService.getInstance();
cacheService.cacheCommuteResult('莘庄', '人民广场', result);
const cachedResult = cacheService.getCachedCommuteResult('莘庄', '人民广场');
```

### 4. MetroServiceCoordinator (服务协调器)

**职责**: 整合所有地铁相关服务，提供统一的接口

**主要功能**:
- 服务协调和整合
- 缓存策略管理
- 批量操作支持
- 系统状态监控
- 推荐路线生成
- 错误处理和日志

**设计模式**: 单例模式

```typescript
// 使用示例
const coordinator = MetroServiceCoordinator.getInstance();
const result = await coordinator.calculateCommuteWithCache('莘庄', '人民广场');
const stats = coordinator.getSystemStats();
```

## 🎯 设计原则

### 1. 单一职责原则 (SRP)
每个服务类只负责一个特定的功能领域

### 2. 开闭原则 (OCP)
对扩展开放，对修改关闭

### 3. 依赖倒置原则 (DIP)
高层模块不依赖低层模块，都依赖抽象

### 4. 接口隔离原则 (ISP)
客户端不应该依赖它不需要的接口

### 5. 里氏替换原则 (LSP)
子类必须能够替换其父类

## 🔄 数据流

```
用户操作 → React组件 → 服务协调器 → 具体服务 → 数据/缓存 → 返回结果
```

## 📊 性能优化

### 1. 缓存策略
- 计算结果缓存
- 站点信息缓存
- 线路信息缓存
- 智能过期管理

### 2. 预加载机制
- 常用路线预加载
- 换乘站点预加载
- 线路信息预加载

### 3. 批量操作
- 批量计算支持
- 批量缓存操作
- 并行处理能力

## 🧪 测试支持

### 1. 工厂模式
每个服务都提供工厂方法，支持测试场景

```typescript
// 测试用实例
const testService = MetroServiceFactory.createTestService();
const testCoordinator = MetroServiceCoordinatorFactory.createTestCoordinator();
```

### 2. 接口抽象
通过接口定义，支持Mock和Stub

```typescript
interface IMetroCalculator {
  calculateCommute(fromStation: string, toStation: string): DistanceResult | null;
  // ... 其他方法
}
```

## 🚀 扩展性

### 1. 新服务添加
只需实现相应接口，注册到协调器即可

### 2. 配置扩展
在配置服务中添加新的配置项

### 3. 算法优化
在核心服务中替换算法实现

### 4. 缓存策略
支持多种缓存后端（Redis、内存、本地存储等）

## 📈 监控和统计

### 1. 系统统计
- 总站点数
- 总线路数
- 换乘站点数
- 缓存命中率

### 2. 性能监控
- 计算耗时
- 缓存效果
- 服务健康状态

### 3. 错误处理
- 异常捕获
- 错误日志
- 降级策略

## 🔧 配置管理

### 1. 运行时配置
支持动态修改配置参数

### 2. 环境配置
支持不同环境的配置

### 3. 配置验证
配置参数的类型和范围验证

## 📱 前端集成

### 1. React Hooks
提供自定义Hooks封装服务调用

### 2. 状态管理
与服务层状态同步

### 3. 错误边界
优雅处理服务层异常

## 🔮 未来规划

### 1. 微服务化
将服务层拆分为独立的微服务

### 2. 分布式缓存
支持Redis等分布式缓存

### 3. 实时数据
集成实时地铁信息

### 4. AI优化
机器学习优化路线推荐

## 📝 使用指南

### 1. 基本使用
```typescript
import { MetroServiceCoordinator } from './services';

const coordinator = MetroServiceCoordinator.getInstance();
const result = await coordinator.calculateCommuteWithCache('莘庄', '人民广场');
```

### 2. 配置修改
```typescript
import { MetroConfigService } from './services';

const configService = MetroConfigService.getInstance();
configService.set('timePerStation', 4);
```

### 3. 缓存管理
```typescript
import { MetroCacheService } from './services';

const cacheService = MetroCacheService.getInstance();
cacheService.clear();
```

### 4. 系统监控
```typescript
import { MetroServiceCoordinator } from './services';

const coordinator = MetroServiceCoordinator.getInstance();
const stats = coordinator.getSystemStats();
const health = coordinator.checkServiceHealth();
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进服务层架构！

## 📄 许可证

本项目采用开源许可证，可自由使用和修改。
