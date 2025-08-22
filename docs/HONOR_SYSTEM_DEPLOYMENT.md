# 荣誉系统部署指南

## 概述

荣誉系统包含头像框管理和活动发放功能，支持头像框图片上传、压缩、预览和批量发放。发放记录统一存储在现有的 `achievement_progress_logs` 表中。

## 数据库部署

### 1. 执行 SQL 脚本

在 Supabase SQL Editor 中执行以下脚本：

```sql
-- 部署荣誉系统数据库结构
-- 文件：deploy_honor_system.sql

-- 为 avatar_frames 表添加 icon_url 字段
ALTER TABLE avatar_frames 
ADD COLUMN IF NOT EXISTS icon_url text;

-- 添加注释
COMMENT ON COLUMN avatar_frames.icon_url IS '头像框图片URL，支持PNG、JPG等格式';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_avatar_frames_icon_url ON avatar_frames(icon_url) WHERE icon_url IS NOT NULL;
```

### 2. 验证部署

检查以下内容：
- `avatar_frames` 表是否有 `icon_url` 字段
- 现有的 `achievement_progress_logs` 表结构是否正确

## 前端部署

### 1. 新增页面

- `src/pages/HonorManagement.tsx` - 荣誉系统管理页面
- 包含头像框上传、压缩、预览、删除功能
- 包含批量发放头像框功能

### 2. 导航菜单更新

- 在 `src/components/NavigationMenu.tsx` 中添加荣誉系统菜单
- 在 `src/App.tsx` 中添加路由配置

### 3. 功能特性

#### 头像框管理
- **设计规范提示**：页面顶部显示头像框设计规范
- **图片上传**：支持 PNG、JPG、WebP 格式
- **图片压缩**：自动压缩到 256x256px，文件大小 < 200KB
- **图片裁剪**：圆形裁剪，支持预览
- **图片预览**：点击预览按钮查看大图
- **图片删除**：删除已上传的图片

#### 活动发放
- **用户选择**：多选用户，支持搜索
- **头像框选择**：多选头像框
- **批量发放**：一次性发放多个头像框给多个用户
- **发放记录**：记录发放历史，包含发放人、时间、说明

## 数据存储说明

### 发放记录存储

荣誉发放记录统一存储在 `achievement_progress_logs` 表中：

```sql
-- 发放记录结构
{
  user_id: bigint,           -- 用户ID
  achievement_id: uuid,       -- 头像框ID（复用字段）
  old_progress: 0,           -- 旧进度（固定为0）
  new_progress: 1,           -- 新进度（固定为1）
  progress_change: 1,        -- 进度变化（固定为1）
  trigger_source: 'honor_grant', -- 触发来源
  trigger_data: {            -- 触发数据（JSON）
    frame_id: uuid,          -- 头像框ID
    frame_name: string,      -- 头像框名称
    granted_by: bigint,      -- 发放人ID
    notes: string,           -- 发放说明
    granted_at: timestamp    -- 发放时间
  }
}
```

### 优势

1. **统一管理**：所有成就相关记录都在同一表中
2. **数据一致性**：复用现有的表结构和索引
3. **查询便利**：可以通过 `trigger_source` 字段区分不同类型的记录
4. **扩展性好**：未来可以轻松添加其他类型的成就记录

## 使用说明

### 1. 访问荣誉系统

1. 登录系统后，在左侧导航菜单找到"荣誉系统"
2. 点击"荣誉管理"进入管理页面

### 2. 上传头像框

1. 在"头像框管理"标签页中
2. 查看页面顶部的设计规范
3. 点击头像框卡片上的"上传图片"按钮
4. 选择图片文件，系统会自动压缩和裁剪
5. 上传成功后可以预览和删除

### 3. 批量发放头像框

1. 切换到"活动发放"标签页
2. 选择要发放的用户（支持多选和搜索）
3. 选择要发放的头像框（支持多选）
4. 填写发放说明（可选）
5. 点击"发放"按钮完成批量发放

## 技术细节

### 图片存储
- 存储位置：`achievement-icons/avatar-frames/`
- 文件命名：`avatar-frame-{frameId}-{timestamp}.{ext}`
- 压缩参数：最大 256x256px，文件大小 < 200KB

### 数据库表结构
- `avatar_frames.icon_url`：存储图片的 publicUrl
- `achievement_progress_logs`：统一存储发放记录

### 权限控制
- 只有管理员可以访问荣誉系统管理页面
- 用户只能查看自己的发放记录
- 管理员可以查看所有发放记录

## 查询示例

### 查询荣誉发放记录

```sql
-- 查询所有荣誉发放记录
SELECT 
  apl.id,
  apl.user_id,
  apl.achievement_id as frame_id,
  apl.trigger_data->>'frame_name' as frame_name,
  apl.trigger_data->>'notes' as notes,
  apl.created_at,
  up.name as user_name
FROM achievement_progress_logs apl
JOIN users_profile up ON apl.user_id = up.id
WHERE apl.trigger_source = 'honor_grant'
ORDER BY apl.created_at DESC;
```

### 查询用户获得的头像框

```sql
-- 查询用户获得的所有头像框
SELECT 
  uaf.user_id,
  uaf.frame_id,
  af.name as frame_name,
  af.icon_url,
  uaf.unlocked_at
FROM user_avatar_frames uaf
JOIN avatar_frames af ON uaf.frame_id = af.id
WHERE uaf.user_id = :user_id;
```

## 故障排除

### 常见问题

1. **图片上传失败**
   - 检查文件格式是否支持
   - 检查文件大小是否超限
   - 检查网络连接

2. **发放失败**
   - 检查用户和头像框是否选择
   - 检查数据库连接
   - 查看浏览器控制台错误信息

3. **页面加载失败**
   - 检查数据库表是否创建成功
   - 检查用户权限是否正确

### 日志查看

- 前端错误：浏览器开发者工具 Console
- 数据库错误：Supabase Dashboard > Logs
- 存储错误：Supabase Dashboard > Storage

## 更新日志

- 2024-12-XX：初始版本发布
- 支持头像框图片上传和压缩
- 支持批量发放功能
- 统一使用 achievement_progress_logs 表存储发放记录 