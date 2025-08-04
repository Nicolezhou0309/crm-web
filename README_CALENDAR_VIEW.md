# 跟进记录日历视图

## 📅 功能简介

这是一个全新的跟进记录日历视图功能，允许用户以直观的日历形式查看和管理跟进记录。该功能基于 `followups` 表的 `moveintime`（入住日期）字段来显示数据。

## ✨ 主要特性

- **📅 日历显示**：以月历形式显示所有跟进记录
- **🎨 颜色编码**：不同跟进阶段用不同颜色标识
- **🔍 智能过滤**：支持跟进阶段过滤，月份切换自动加载数据
- **📱 响应式设计**：完美支持桌面端和移动端
- **💬 详情弹窗**：点击日期查看完整的跟进记录信息
- **⚡ 实时数据**：基于Supabase实时数据更新

## 🚀 快速开始

### 1. 部署功能
```bash
# 运行部署脚本
./deploy-calendar-view.sh
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 访问页面
- 直接访问：`http://localhost:5173/followups-calendar`
- 或通过导航菜单：线索管理 → 跟进日历

### 4. 默认显示本月
- 页面加载后自动显示当前月份的数据
- 顶部显示当前月份信息和数据范围
- 支持快速重置为当月视图

### 5. 数据要求
```sql
-- 日历视图使用现有的 followups 表中的 moveintime 字段
-- 只要该字段有数据即可正常显示
-- 无需额外的数据表或字段
```

## 📊 数据要求

### 必要字段
- `moveintime`：入住日期（日历显示依据）
- `followupstage`：跟进阶段
- `customerprofile`：客户画像

### 可选字段
- `userrating`：来访意向
- `scheduledcommunity`：预约社区
- `interviewsales_user_id`：负责销售

## 🎨 颜色编码系统

| 跟进阶段 | 颜色 | 说明 |
|---------|------|------|
| 待接收 | 灰色 | 新接收的线索 |
| 已接收/已联系 | 蓝色 | 正在跟进中 |
| 已约访 | 橙色 | 已预约看房 |
| 已带看/已成交 | 绿色 | 成功案例 |
| 已流失 | 红色 | 需要重新跟进 |

## 🔧 技术实现

### 前端技术栈
- React 18 + TypeScript
- Ant Design 5.x
- Day.js（日期处理）
- Supabase客户端

### 核心组件
- `Calendar`：Ant Design日历组件
- `Modal`：详情弹窗
- `List`：记录列表显示
- `Badge`：状态标识

### 数据获取
```typescript
// 主要查询逻辑
const { data, error } = await supabase
  .from('followups')
  .select(`
    id, leadid, followupstage, customerprofile,
    worklocation, userbudget, moveintime, userrating,
    scheduledcommunity, interviewsales_user_id,
    users_profile!followups_interviewsales_user_id_fkey(name)
  `)
  .not('moveintime', 'is', null);
```

## 📁 文件结构

```
src/
├── pages/
│   ├── FollowupsCalendarView.tsx    # 主页面组件
│   └── FollowupsCalendarView.css    # 样式文件
├── components/
│   └── NavigationMenu.tsx           # 导航菜单（已更新）
└── App.tsx                          # 路由配置（已更新）

docs/
└── FOLLOWUPS_CALENDAR_VIEW_GUIDE.md # 详细使用指南

deploy-calendar-view.sh              # 部署脚本
```

## 🎯 使用场景

### 1. 销售管理
- 查看每日跟进任务
- 跟踪客户进度
- 识别高价值线索

### 2. 团队协作
- 共享客户跟进状态
- 协调看房时间
- 避免重复跟进

### 3. 数据分析
- 跟进效率分析
- 转化率统计
- 时间分布分析

## 🔍 过滤功能

### 日期范围过滤
- 选择特定时间段
- 快速跳转到指定月份
- 重置为当月数据

### 跟进阶段过滤
- 按阶段筛选记录
- 重点关注特定状态
- 批量处理同类记录



## 📱 移动端优化

### 响应式布局
- 自适应屏幕尺寸
- 触摸友好的交互
- 优化的显示效果

### 性能优化
- 懒加载数据
- 虚拟滚动（未来版本）
- 缓存机制

## 🔮 未来规划

### 短期计划
- [ ] 拖拽编辑入住日期
- [ ] 批量操作功能
- [ ] 导出日历数据
- [ ] 更多过滤条件

### 长期规划
- [ ] 统计图表集成
- [ ] 智能提醒功能
- [ ] 多视图切换
- [ ] 自定义主题

## 🐛 故障排除

### 常见问题

**Q: 日历不显示数据？**
A: 检查是否有设置了 `moveintime` 的跟进记录

**Q: 过滤不生效？**
A: 确认过滤条件正确，数据格式匹配

**Q: 详情弹窗无内容？**
A: 检查该日期是否有跟进记录，确认数据权限

### 技术支持
如遇到问题，请联系开发团队或查看详细文档。

## 📖 相关文档

- [详细使用指南](docs/FOLLOWUPS_CALENDAR_VIEW_GUIDE.md)
- [API文档](docs/API_REFERENCE.md)
- [部署指南](docs/DEPLOYMENT_GUIDE.md)

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个功能！

---

**版本**: 1.0.0  
**最后更新**: 2025-01-15  
**维护者**: CRM开发团队 