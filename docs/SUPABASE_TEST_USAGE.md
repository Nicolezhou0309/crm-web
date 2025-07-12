# Supabase数据测试使用指南

## 📋 概述

本指南帮助您使用JavaScript代码连接Supabase进行积分分配系统的数据测试。

## 🚀 快速开始

### 方法1：浏览器测试（推荐）

1. **打开测试页面**
   ```
   http://localhost:5177/test-supabase.html
   ```

2. **自动测试连接**
   - 页面加载时会自动测试Supabase连接
   - 查看连接状态和日志

3. **运行测试**
   - 点击"运行所有测试"按钮
   - 或分别运行各个测试模块

### 方法2：JavaScript文件测试

1. **导入测试文件**
   ```javascript
   import { runAllTests, cleanupTestData } from './test_supabase_connection.js'
   ```

2. **运行测试**
   ```javascript
   // 运行所有测试
   await runAllTests()
   
   // 清理测试数据
   await cleanupTestData()
   ```

## 🔧 测试模块

### 1. 连接测试
- **功能**: 验证Supabase连接是否正常
- **按钮**: "测试Supabase连接"
- **预期结果**: ✅ Supabase连接成功

### 2. 系统组件检查
- **功能**: 检查积分分配系统所需组件
- **检查项目**:
  - 积分分配枚举 (`points`)
  - 积分成本表 (`lead_points_cost`)
  - 分配日志积分字段
- **按钮**: "检查系统组件"

### 3. 测试用户管理
- **功能**: 创建和管理测试用户
- **创建用户**:
  - 测试用户A (ID: 1001, 积分: 100)
  - 测试用户B (ID: 1002, 积分: 50)
  - 测试用户C (ID: 1003, 积分: 200)
- **按钮**: "创建测试用户" / "清理测试用户"

### 4. 积分成本计算测试
- **功能**: 测试积分成本计算逻辑
- **测试案例**:
  - 基础成本测试
  - 动态调整测试
  - 高价值线索测试
- **按钮**: "测试积分成本计算"

### 5. 积分分配逻辑测试
- **功能**: 测试积分分配算法
- **测试内容**: 从积分足够的用户中选择分配目标
- **按钮**: "测试积分分配逻辑"

### 6. 测试线索创建
- **功能**: 创建测试线索触发分配
- **创建线索**:
  - 高价值线索 (抖音 + 意向客户 + 高端别墅)
  - 普通线索 (微信 + 准客户 + 普通广告)
  - 低价值线索 (百度 + 潜在客户 + 基础广告)
- **按钮**: "创建测试线索" / "清理测试线索"

### 7. 查看测试结果
- **功能**: 查看分配结果和积分交易
- **查看内容**:
  - 分配日志
  - 积分交易记录
  - Followups记录
- **按钮**: "查看测试结果"

## 📊 预期测试结果

### 成功指标
- ✅ Supabase连接成功
- ✅ 所有系统组件存在
- ✅ 测试用户创建成功
- ✅ 积分成本计算正常
- ✅ 积分分配逻辑正常
- ✅ 测试线索分配成功
- ✅ 积分扣除成功
- ✅ Followups记录创建成功

### 示例结果
```json
{
  "分配日志": {
    "leadid": "JS_TEST_高价值线索_xxx",
    "assigned_user_id": 1003,
    "allocation_method": "points",
    "points_cost": 75,
    "user_balance_before": 200,
    "user_balance_after": 125
  },
  "积分交易": {
    "user_id": 1003,
    "points_change": -75,
    "balance_after": 125,
    "transaction_type": "DEDUCT",
    "description": "线索分配扣除积分：JS_TEST_高价值线索_xxx"
  },
  "Followups": {
    "leadid": "JS_TEST_高价值线索_xxx",
    "leadtype": "意向客户",
    "followupstage": "待接收",
    "interviewsales_user_id": 1003
  }
}
```

## 🛠️ 故障排除

### 常见问题

#### 1. 连接失败
**症状**: "❌ 连接失败"
**解决**:
- 检查网络连接
- 验证Supabase URL和密钥
- 确认Supabase服务状态

#### 2. 函数不存在
**症状**: "❌ 函数 xxx 不存在"
**解决**:
- 确认已执行SQL部署脚本
- 检查函数名称是否正确
- 验证数据库权限

#### 3. 表不存在
**症状**: "❌ 表 xxx 不存在"
**解决**:
- 确认已创建相关表
- 检查表名拼写
- 验证数据库权限

#### 4. 触发器不工作
**症状**: 线索创建后没有触发分配
**解决**:
- 检查触发器是否存在
- 确认触发器函数正确
- 验证触发器权限

### 调试技巧

#### 1. 查看详细日志
```javascript
// 在浏览器控制台中查看详细错误
console.log('详细错误信息:', error)
```

#### 2. 检查数据库状态
```sql
-- 在Supabase SQL编辑器中执行
SELECT * FROM information_schema.tables WHERE table_schema = 'public';
SELECT * FROM pg_proc WHERE proname LIKE '%points%';
```

#### 3. 验证数据完整性
```sql
-- 检查测试用户
SELECT * FROM users_profile WHERE id IN (1001, 1002, 1003);

-- 检查积分钱包
SELECT * FROM user_points_wallet WHERE user_id IN (1001, 1002, 1003);

-- 检查分配日志
SELECT * FROM simple_allocation_logs ORDER BY created_at DESC LIMIT 10;
```

## 📈 性能监控

### 批量测试
```javascript
// 创建100个测试线索
for (let i = 1; i <= 100; i++) {
    await createTestLead(`BATCH_TEST_${i}`)
}
```

### 性能指标
- **分配速度**: 每个线索的分配时间
- **积分计算速度**: 成本计算响应时间
- **数据库响应**: 查询和写入性能

## 🧹 数据清理

### 自动清理
- 测试完成后自动清理测试数据
- 保留生产数据不受影响

### 手动清理
```javascript
// 清理所有测试数据
await cleanupTestData()

// 清理特定类型数据
await cleanupTestLeads()
await cleanupTestUsers()
```

## 📞 技术支持

### 检查清单
1. ✅ Supabase连接正常
2. ✅ 数据库权限正确
3. ✅ 所有表已创建
4. ✅ 所有函数已部署
5. ✅ 触发器已配置
6. ✅ 测试用户已创建

### 联系支持
如果遇到问题，请提供：
- 错误信息截图
- 浏览器控制台日志
- 测试步骤描述
- 环境信息（浏览器、操作系统等）

## 🎯 测试成功标准

✅ **连接测试通过**
✅ **系统组件完整**
✅ **用户管理正常**
✅ **成本计算准确**
✅ **分配逻辑正确**
✅ **数据一致性保持**
✅ **性能满足要求**

当所有测试项目都通过时，说明积分分配系统已经成功部署并正常工作！ 