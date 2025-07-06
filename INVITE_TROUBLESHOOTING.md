# 🔧 邀请功能故障排除指南

## 问题描述
邀请成员功能出现以下错误：
- `Failed to load resource: the server responded with a status of 500 ()`
- `Edge Function returned a non-2xx status code`
- `invalid claim: missing sub claim`

## 🔍 问题诊断

### 1. 认证状态检查
**问题**: 用户认证状态异常导致邀请失败

**解决方案**:
```bash
# 打开认证状态检查工具
open debug-auth.html
```

或者在浏览器中访问：`file:///path/to/your/project/debug-auth.html`

### 2. 前端认证状态检查
在部门页面中点击"检查认证"按钮，查看控制台输出：

**正常状态应该显示**:
```javascript
🔍 认证状态检查: {
  hasSession: true,
  hasUser: true,
  sessionUserId: "user-id-here",
  userUserId: "user-id-here",
  hasAccessToken: true
}

🔐 JWT Claims: {
  sub: "user-id-here",
  role: "authenticated",
  iss: "supabase",
  hasSub: true
}
```

**异常状态**:
- `hasSession: false` - 用户未登录
- `hasSub: false` - JWT token 无效

## 🛠️ 解决方案

### 方案1：重新登录
如果认证状态异常，请：
1. 退出当前账户
2. 清除浏览器缓存和 LocalStorage
3. 重新登录系统

### 方案2：检查环境变量
确保环境变量正确配置：
```bash
# 运行环境变量设置脚本
./setup-env.sh
```

### 方案3：验证Edge Function配置
检查 Edge Function 是否正确配置：
```bash
# 运行测试脚本
./test-invite-function.sh
```

### 方案4：检查数据库权限
确保您的用户在数据库中有正确的权限：
```sql
-- 检查用户是否存在于 users_profile 表
SELECT * FROM users_profile WHERE user_id = 'your-user-id';

-- 检查用户是否有管理员权限
SELECT * FROM organizations WHERE admin = 'your-user-id';
```

## 📋 详细调试步骤

### 步骤1：检查认证状态
```javascript
// 在浏览器控制台执行
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

### 步骤2：手动测试邀请功能
```javascript
// 在浏览器控制台执行
const { data, error } = await supabase.functions.invoke('invite-user', {
  body: {
    email: 'test@example.com',
    nickname: '测试用户',
    organizationId: 'your-org-id',
    redirectTo: window.location.origin + '/login'
  }
});
console.log('Result:', { data, error });
```

### 步骤3：检查部门权限
```javascript
// 在浏览器控制台执行
const { data: orgs } = await supabase
  .from('organizations')
  .select('*')
  .eq('admin', 'your-user-id');
console.log('Managed Organizations:', orgs);
```

## 🎯 常见错误及解决方法

### 错误1：`invalid claim: missing sub claim`
**原因**: JWT token 中缺少用户ID信息
**解决**: 重新登录系统

### 错误2：`未授权`
**原因**: 用户没有登录或token过期
**解决**: 刷新页面重新登录

### 错误3：`无权管理此组织`
**原因**: 用户不是该部门的管理员
**解决**: 确认用户权限或联系上级管理员

### 错误4：`该邮箱已被注册`
**原因**: 邮箱已存在于系统中
**解决**: 使用"发送密码重置"功能

## 🔄 快速修复流程

1. **检查登录状态**
   ```bash
   # 打开调试工具
   open debug-auth.html
   ```

2. **清除缓存重新登录**
   - 按 F12 打开开发者工具
   - 右击刷新按钮 → 选择"清空缓存并硬性重新加载"
   - 重新登录系统

3. **验证邀请功能**
   - 选择一个部门
   - 点击"邀请成员"
   - 查看控制台日志

4. **如果问题持续**
   - 联系系统管理员
   - 提供控制台错误日志
   - 提供认证状态检查结果

## 📞 技术支持

如果按照上述步骤仍无法解决问题，请提供：
1. 浏览器控制台完整错误日志
2. 认证状态检查结果
3. 用户权限信息
4. 操作步骤截图

## 🧪 测试命令

```bash
# 测试所有功能
chmod +x test-invite-function.sh && ./test-invite-function.sh

# 设置环境变量
chmod +x setup-env.sh && ./setup-env.sh

# 部署Edge Function（如需要）
./deploy-invite-user.sh
```

---

**最后更新**: 2024年1月
**版本**: 1.0.0 