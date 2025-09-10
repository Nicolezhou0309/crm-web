# 简化认证架构 - 移除wecomAuthManager

## 当前问题
- `wecomAuthManager`只是简单包装了`tokenManager.setSession()`
- 没有添加实质性的业务逻辑
- 增加了不必要的代码复杂度
- 与`tokenManager`功能重叠

## 简化方案

### 方案A: 完全移除wecomAuthManager（推荐）

#### 1. 修改useAuth.ts
```typescript
// 移除wecomAuthManager导入
// import { wecomAuthManager } from '../utils/wecomAuthManager';

// 在login方法中直接处理企业微信登录
const login = useCallback(async (email: string, password: string, metadata?: any) => {
  try {
    setAuthError(null);
    
    // 如果有企业微信元数据，直接使用tokenManager
    if (metadata && metadata.wechat_work_userid) {
      console.log('🔍 企业微信登录，直接使用tokenManager');
      
      // 检查是否有会话信息
      if (!metadata.session) {
        setAuthError('缺少会话信息');
        return { success: false, error: '缺少会话信息' };
      }
      
      // 直接使用tokenManager设置会话
      const { data, error } = await tokenManager.setSession(
        metadata.session.access_token,
        metadata.session.refresh_token
      );
      
      if (error) {
        setAuthError(error.message || '企业微信登录失败');
        return { success: false, error: error.message || '企业微信登录失败' };
      }
      
      if (data?.user) {
        // 登录成功后立即刷新用户状态
        try {
          await refreshUser();
        } catch (error) {
          console.error('企业微信登录成功后刷新用户状态失败:', error);
        }
        return { success: true };
      } else {
        setAuthError('企业微信登录响应异常');
        return { success: false, error: '企业微信登录响应异常' };
      }
    } else {
      // 标准邮箱密码登录
      const { data, error } = await tokenManager.signInWithPassword(email, password);
      // ... 现有逻辑
    }
  } catch (error) {
    // ... 现有错误处理
  }
}, []);
```

#### 2. 删除wecomAuthManager.ts文件
```bash
rm src/utils/wecomAuthManager.ts
```

#### 3. 更新所有引用
- 移除所有`import { wecomAuthManager }`语句
- 直接使用`tokenManager.setSession()`

### 方案B: 简化wecomAuthManager（备选）

如果希望保留企业微信特定的处理，可以简化实现：

```typescript
// 简化后的wecomAuthManager.ts
import { tokenManager } from './tokenManager';

export class WecomAuthManager {
  static async signInWithWecom(userInfo: any) {
    // 验证企业微信用户信息
    if (!userInfo.session?.access_token) {
      return { data: null, error: new Error('缺少有效的会话令牌') };
    }
    
    // 直接调用tokenManager
    return await tokenManager.setSession(
      userInfo.session.access_token,
      userInfo.session.refresh_token
    );
  }
}
```

## 优势

### 简化后架构优势
1. **减少代码复杂度** - 移除73行不必要的代码
2. **统一认证管理** - 所有认证都通过tokenManager
3. **更易维护** - 减少抽象层，逻辑更清晰
4. **性能提升** - 减少函数调用层级
5. **代码一致性** - 所有登录方式使用相同的管理器

### 具体改进
- 减少文件数量：从2个管理器减少到1个
- 减少代码行数：从775行减少到702行
- 简化调用链：从3层减少到2层
- 统一错误处理：所有认证错误都通过tokenManager处理

## 实施步骤

1. **备份当前代码**
2. **修改useAuth.ts** - 移除wecomAuthManager依赖
3. **删除wecomAuthManager.ts**
4. **测试企业微信登录功能**
5. **清理其他可能的引用**

## 风险评估

- **低风险** - wecomAuthManager没有复杂的业务逻辑
- **易于回滚** - 如果出现问题，可以快速恢复
- **功能不变** - 用户体验完全一致

## 结论

**强烈推荐采用方案A**，完全移除`wecomAuthManager`，直接使用`tokenManager`处理所有认证，包括企业微信登录。这样可以简化架构，提高代码质量，同时保持所有功能不变。
