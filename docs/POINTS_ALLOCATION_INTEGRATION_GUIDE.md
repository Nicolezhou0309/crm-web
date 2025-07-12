# 积分分配规则集成指南

## 概述

积分分配规则已成功集成到线索分配管理系统中，作为分配管理页面的子标签页。用户可以在分配管理页面中直接管理积分成本规则，无需跳转到单独的页面。

## 功能特性

### 1. 集成位置
- **页面**: 分配管理页面 (`/allocation-management`)
- **标签页**: "积分规则" 标签页
- **图标**: 🏆 (TrophyOutlined)

### 2. 核心功能
- ✅ 查看所有积分成本规则
- ✅ 创建新的积分成本规则
- ✅ 编辑现有积分成本规则
- ✅ 删除积分成本规则
- ✅ 规则优先级管理
- ✅ 条件配置和动态调整

### 3. 表格显示
积分规则表格包含以下列：
- **规则名称**: 显示规则名称和启用状态
- **基础积分成本**: 显示积分成本数值
- **优先级**: 显示优先级标签（颜色编码）
- **条件配置**: 显示触发条件数量
- **动态调整**: 显示调整配置数量
- **操作**: 编辑和删除按钮

## 使用方法

### 1. 访问积分规则管理
1. 登录系统
2. 导航到 "分配管理" 页面
3. 点击 "积分规则" 标签页

### 2. 创建新规则
1. 点击 "新增积分规则" 按钮
2. 填写规则信息：
   - **规则名称**: 必填，规则标识
   - **基础积分成本**: 必填，1-1000积分
   - **规则描述**: 可选，规则说明
   - **优先级**: 数字越大优先级越高
   - **是否启用**: 控制规则是否生效
   - **触发条件**: JSON格式，例如：
     ```json
     {
       "sources": ["抖音", "微信"],
       "lead_types": ["普通", "高意向"],
       "communities": ["测试社区"]
     }
     ```
   - **动态调整配置**: JSON格式，例如：
     ```json
     {
       "source_adjustments": {
         "抖音": 15,
         "微信": 10
       },
       "keyword_adjustments": {
         "高意向": 20
       }
     }
     ```
3. 点击 "创建规则" 保存

### 3. 编辑规则
1. 在规则列表中点击 "编辑" 按钮
2. 修改规则信息
3. 点击 "更新规则" 保存

### 4. 删除规则
1. 在规则列表中点击 "删除" 按钮
2. 确认删除操作

## 技术实现

### 1. 前端集成
- **文件**: `src/pages/AllocationManagement.tsx`
- **API**: `src/utils/pointsAllocationApi.ts`
- **类型**: `PointsCostRule` 接口

### 2. 新增组件
- 积分规则表格列配置 (`pointsRuleColumns`)
- 积分规则标签页内容 (`pointsAllocationTabContent`)
- 积分规则编辑弹窗
- 积分规则处理函数

### 3. 状态管理
```typescript
// 积分分配规则相关状态
const [pointsCostRules, setPointsCostRules] = useState<PointsCostRule[]>([]);
const [isPointsRuleModalVisible, setIsPointsRuleModalVisible] = useState(false);
const [editingPointsRule, setEditingPointsRule] = useState<PointsCostRule | null>(null);
const [pointsRuleForm] = Form.useForm();
```

### 4. API接口
```typescript
// 积分成本规则API
const costRules = {
  getRules: async (): Promise<PointsAllocationApiResponse<PointsCostRule[]>>
  createRule: async (rule: Partial<PointsCostRule>): Promise<PointsAllocationApiResponse<PointsCostRule>>
  updateRule: async (id: string, rule: Partial<PointsCostRule>): Promise<PointsAllocationApiResponse<PointsCostRule>>
  deleteRule: async (id: string): Promise<PointsAllocationApiResponse<void>>
}
```

## 数据库表结构

### lead_points_cost 表
```sql
CREATE TABLE lead_points_cost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_points_cost INTEGER NOT NULL DEFAULT 50,
  conditions JSONB DEFAULT '{}',
  dynamic_cost_config JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 配置示例

### 1. 基础积分规则
```json
{
  "name": "基础积分规则",
  "description": "所有线索的基础积分成本",
  "base_points_cost": 50,
  "priority": 100,
  "is_active": true,
  "conditions": {},
  "dynamic_cost_config": {}
}
```

### 2. 来源特定规则
```json
{
  "name": "抖音高价值线索",
  "description": "抖音来源的高价值线索积分规则",
  "base_points_cost": 75,
  "priority": 200,
  "is_active": true,
  "conditions": {
    "sources": ["抖音"],
    "lead_types": ["高意向"]
  },
  "dynamic_cost_config": {
    "source_adjustments": {
      "抖音": 15
    }
  }
}
```

### 3. 关键词调整规则
```json
{
  "name": "关键词调整规则",
  "description": "基于关键词的动态积分调整",
  "base_points_cost": 60,
  "priority": 150,
  "is_active": true,
  "conditions": {},
  "dynamic_cost_config": {
    "keyword_adjustments": {
      "高意向": 20,
      "紧急": 30,
      "VIP": 50
    }
  }
}
```

## 注意事项

### 1. JSON格式要求
- 触发条件和动态调整配置必须使用有效的JSON格式
- 建议使用JSON.stringify()格式化显示
- 保存时会自动解析JSON字符串

### 2. 优先级规则
- 数字越大优先级越高
- 相同优先级的规则按创建时间排序
- 建议使用100的倍数便于管理

### 3. 条件匹配
- 支持多维度条件组合
- 条件为空时匹配所有线索
- 条件之间为AND关系

### 4. 动态调整
- 支持来源、关键词、时间等多维度调整
- 调整值会累加到基础积分成本上
- 最终积分成本 = 基础成本 + 各项调整

## 测试验证

### 1. 功能测试
- [ ] 创建积分成本规则
- [ ] 编辑积分成本规则
- [ ] 删除积分成本规则
- [ ] 规则优先级排序
- [ ] JSON格式验证

### 2. 集成测试
- [ ] 积分规则与分配流程集成
- [ ] 积分扣除功能验证
- [ ] 积分不足时的回退机制
- [ ] 分配日志记录

### 3. 性能测试
- [ ] 大量规则时的加载性能
- [ ] 规则匹配的计算性能
- [ ] 数据库查询优化

## 故障排除

### 1. 常见问题
**Q: 积分规则不生效？**
A: 检查规则是否启用，优先级是否正确，条件是否匹配

**Q: JSON格式错误？**
A: 确保JSON格式正确，可以使用在线JSON验证工具

**Q: 积分扣除失败？**
A: 检查用户积分余额，分配方法是否为积分分配

### 2. 调试方法
1. 检查浏览器控制台错误信息
2. 查看网络请求响应
3. 验证数据库表结构和数据
4. 测试API接口功能

## 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 积分分配规则集成到分配管理页面
- ✅ 完整的CRUD操作支持
- ✅ JSON格式的条件和配置管理
- ✅ 优先级和状态管理
- ✅ 响应式表格显示

## 后续计划

### 1. 功能增强
- [ ] 规则模板功能
- [ ] 批量导入导出
- [ ] 规则测试工具
- [ ] 统计分析图表

### 2. 用户体验
- [ ] 可视化规则编辑器
- [ ] 拖拽排序功能
- [ ] 规则预览功能
- [ ] 操作历史记录

### 3. 性能优化
- [ ] 规则缓存机制
- [ ] 分页加载优化
- [ ] 搜索过滤功能
- [ ] 实时更新通知 