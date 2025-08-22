# 阿里云Supabase设置指南

## 🎯 项目信息

- **项目ID**: 1865238354801584
- **区域**: cn-shanghai (上海)
- **服务类型**: 阿里云Supabase

## 🚀 快速开始

### 1. 安装阿里云CLI

```bash
# macOS (使用Homebrew)
brew install aliyun-cli

# 或者下载安装包
# https://help.aliyun.com/zh/cli/
```

### 2. 配置阿里云CLI

```bash
aliyun configure
# 输入AccessKey ID、Secret、默认区域(cn-shanghai)
```

### 3. 测试连接

```bash
# 运行连接脚本
./connect-aliyun-supabase.sh

# 或者运行测试脚本
node test-aliyun-mcp.mjs
```

## 🔧 MCP服务器配置

### Cursor MCP配置

在 `.cursor/mcp.json` 中配置：

```json
{
  "mcpServers": {
    "aliyun-supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@aliyun-supabase/mcp-server-supabase@latest",
        "--features=aliyun",
        "--read-only"
      ],
      "env": {
        "ALIYUN_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN_HERE",
        "ALIYUN_REGION": "cn-shanghai",
        "ALIYUN_PROJECT_ID": "1865238354801584"
      }
    }
  }
}
```

### 环境变量配置

复制 `env.aliyun.example` 为 `.env.aliyun` 并填写：

```bash
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_REGION=cn-shanghai
ALIYUN_SUPABASE_PROJECT_ID=1865238354801584
```

## 📋 使用步骤

### 1. 重启Cursor编辑器

配置完成后，完全重启Cursor编辑器。

### 2. 检查MCP工具

进入 Cursor Settings → Tools & Integrations → MCP Tools，确认看到 `aliyun-supabase` 服务。

### 3. 使用MCP工具

通过MCP工具可以：
- 查看数据库表结构
- 检查边缘函数状态
- 管理用户和权限
- 配置JWT和认证
- 查看实例配置信息

## 🔍 故障排除

### 常见问题

1. **MCP工具未显示**
   - 确认配置文件已保存
   - 完全重启Cursor
   - 检查访问密钥权限

2. **连接失败**
   - 检查阿里云RAM权限
   - 确认Supabase实例状态
   - 查看MCP服务器日志

3. **认证错误**
   - 验证AccessKey权限
   - 确认项目ID和区域正确
   - 检查网络连接

### 日志查看

```bash
# 查看MCP服务器日志
node test-aliyun-mcp.mjs

# 查看连接状态
./connect-aliyun-supabase.sh
```

## 📁 文件结构

```
.cursor/
  └── mcp.json                    # MCP配置文件
supabase/
  └── aliyun-config.toml         # 阿里云Supabase配置
connect-aliyun-supabase.sh        # 连接脚本
test-aliyun-mcp.mjs              # 测试脚本
env.aliyun.example                # 环境变量示例
ALIYUN_SUPABASE_SETUP.md         # 本指南
```

## 🔐 安全注意事项

- 不要将AccessKey提交到Git
- 使用环境变量存储敏感信息
- 定期轮换访问密钥
- 限制AccessKey权限范围

## 📞 技术支持

如果遇到问题，请：
1. 检查阿里云控制台中的项目状态
2. 查看MCP服务器日志
3. 联系阿里云技术支持

---

**配置完成后，您就可以使用MCP工具管理阿里云Supabase实例了！** 🎉
