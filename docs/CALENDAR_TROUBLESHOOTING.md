# 日历视图故障排除指南

## 常见问题及解决方案

### 1. 400 错误 - API 请求失败

**问题描述**：
```
Failed to load resource: the server responded with a status of 400 ()
```

**可能原因**：
- 日期格式不正确
- 查询参数格式错误
- 数据库权限问题

**解决方案**：

#### 1.1 检查日期格式
确保日期格式为 ISO 8601 格式：
```javascript
// 正确的格式
const startDate = '2025-01-01 00:00:00';
const endDate = '2025-01-31 23:59:59';
```

#### 1.2 简化查询测试
在浏览器控制台中运行以下代码测试基本查询：
```javascript
// 测试基本查询
const { data, error } = await supabase
  .from('followups')
  .select('id, leadid, moveintime, followupstage')
  .not('moveintime', 'is', null)
  .limit(5);

console.log('查询结果:', data);
console.log('错误信息:', error);
```

#### 1.3 检查数据库权限
确保用户有读取 `followups` 表的权限。

### 2. 日历不显示数据

**问题描述**：
日历页面加载成功，但没有显示任何跟进记录。

**可能原因**：
- `followups` 表中没有 `moveintime` 数据
- 数据格式不正确
- 查询条件过于严格

**解决方案**：

#### 2.1 检查数据是否存在
```javascript
// 检查所有followups记录
const { data, error } = await supabase
  .from('followups')
  .select('id, leadid, moveintime, followupstage')
  .limit(10);

console.log('所有记录:', data);
```

#### 2.2 检查moveintime字段
```javascript
// 检查有moveintime的记录
const { data, error } = await supabase
  .from('followups')
  .select('id, leadid, moveintime, followupstage')
  .not('moveintime', 'is', null)
  .limit(10);

console.log('有moveintime的记录:', data);
```

#### 2.3 添加测试数据
如果数据库中没有 `moveintime` 数据，可以手动添加一些测试数据：
```sql
-- 在Supabase Dashboard中执行
UPDATE followups 
SET moveintime = '2025-01-15 10:00:00+00' 
WHERE id = 'your-record-id';
```

### 3. Ant Design 警告

**问题描述**：
```
Warning: [antd: Calendar] `dateCellRender` is deprecated. Please use `cellRender` instead.
Warning: [antd: Button.Group] `Button.Group` is deprecated. Please use `Space.Compact` instead.
```

**解决方案**：
这些警告已经在最新版本中修复，使用新的API：
- `dateCellRender` → `cellRender`
- `Button.Group` → `Space.Compact`

### 4. 过滤功能不生效

**问题描述**：
日期范围、跟进阶段过滤没有效果。

**解决方案**：

#### 4.1 检查过滤条件
确保过滤条件的值正确：
```javascript
// 跟进阶段选项
const stageOptions = [
  { label: '全部阶段', value: 'all' },
  { label: '待接收', value: '待接收' },
  { label: '已接收', value: '已接收' },
  // ...
];
```

#### 4.2 检查数据格式
确保数据库中的值与过滤条件匹配：
```javascript
// 检查数据库中的实际值
const { data, error } = await supabase
  .from('followups')
  .select('followupstage')
  .limit(10);

console.log('数据库中的值:', data);
```

### 5. 详情弹窗无内容

**问题描述**：
点击日期后，详情弹窗显示为空。

**解决方案**：

#### 5.1 检查日期选择逻辑
```javascript
// 在浏览器控制台中测试
const selectedDate = dayjs('2025-01-15');
const dateKey = selectedDate.format('YYYY-MM-DD');
console.log('选择的日期:', dateKey);

// 检查该日期的数据
const dayEvents = calendarData[dateKey] || [];
console.log('该日期的记录:', dayEvents);
```

#### 5.2 检查数据转换
确保数据正确转换到日历格式：
```javascript
// 检查calendarData
console.log('日历数据:', calendarData);
```

### 6. 性能问题

**问题描述**：
页面加载缓慢，响应迟钝。

**解决方案**：

#### 6.1 限制查询数量
```javascript
// 添加limit限制
const { data, error } = await supabase
  .from('followups')
  .select('...')
  .not('moveintime', 'is', null)
  .limit(1000); // 限制查询数量
```

#### 6.2 使用日期范围过滤
避免查询所有数据：
```javascript
// 只查询当前月份的数据
const startOfMonth = dayjs().startOf('month');
const endOfMonth = dayjs().endOf('month');
```

### 7. 移动端显示问题

**问题描述**：
在移动设备上显示异常。

**解决方案**：

#### 7.1 检查CSS响应式设计
确保CSS中有移动端适配：
```css
@media (max-width: 768px) {
  .calendar-filters .ant-space {
    flex-direction: column;
  }
  
  .calendar-cell {
    min-height: 60px;
  }
}
```

#### 7.2 测试移动端交互
在移动设备上测试触摸交互是否正常。

## 调试工具

### 1. 浏览器控制台测试
复制以下代码到浏览器控制台：
```javascript
// 测试基本查询
async function testQuery() {
  const { data, error } = await supabase
    .from('followups')
    .select('id, leadid, moveintime, followupstage')
    .not('moveintime', 'is', null)
    .limit(5);
  
  console.log('查询结果:', data);
  console.log('错误信息:', error);
}

testQuery();
```

### 2. 网络请求检查
在浏览器开发者工具的Network标签中检查：
- 请求URL是否正确
- 请求参数是否正确
- 响应状态码和内容

### 3. 数据库直接查询
在Supabase Dashboard中直接查询：
```sql
-- 检查所有followups记录
SELECT id, leadid, moveintime, followupstage 
FROM followups 
LIMIT 10;

-- 检查有moveintime的记录
SELECT id, leadid, moveintime, followupstage 
FROM followups 
WHERE moveintime IS NOT NULL 
LIMIT 10;
```

## 联系支持

如果以上解决方案都无法解决问题，请：

1. 收集错误信息（控制台日志、网络请求等）
2. 描述问题现象和复现步骤
3. 提供数据库结构信息
4. 联系开发团队获取技术支持

## 预防措施

1. **定期检查数据质量**：确保 `moveintime` 字段有有效数据
2. **监控性能**：定期检查查询性能，避免数据量过大
3. **用户培训**：确保用户了解功能使用方法
4. **版本更新**：及时更新依赖包，修复已知问题 