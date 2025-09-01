# MCP 服务器配置指南

## 🎯 已集成的 MCP 服务器

### 1. 文件系统服务器 (filesystem)
- **包名**: `@modelcontextprotocol/server-filesystem`
- **功能**: 访问本地文件系统
- **访问目录**:
  - `/Users/nichole` (根目录)
  - `/Users/nichole/Desktop` (桌面)
  - `/Users/nichole/Documents` (文档)
  - `/Users/nichole/Downloads` (下载)
  - `/Users/nichole/Pictures` (图片)
  - `/Users/nichole/Music` (音乐)
  - `/Users/nichole/Movies` (电影)

### 2. Git 服务器 (git)
- **包名**: `@cyanheads/git-mcp-server`
- **功能**: Git 仓库操作
- **支持操作**: clone, commit, branch, diff, log, status, push, pull, merge, rebase 等

### 3. Brave 搜索服务器 (brave-search)
- **包名**: `@modelcontextprotocol/server-brave-search`
- **功能**: 网络搜索
- **API 密钥**: `BSA7Lk7FS2LV20rE0A4pJArYK_Cs3Ap`
- **用途**: 实时网络搜索和信息获取

### 4. Playwright 服务器 (playwright)
- **包名**: `@playwright/mcp`
- **功能**: 浏览器自动化
- **支持功能**:
  - 网页自动化测试
  - 浏览器操作
  - 网页截图
  - 表单填写
  - 网页爬取

### 5. Supabase 服务器 (supabase)
- **包名**: `@supabase/mcp-server-supabase`
- **功能**: Supabase 数据库操作
- **需要配置**:
  - `SUPABASE_URL`: 您的 Supabase 项目 URL
  - `SUPABASE_ANON_KEY`: 您的 Supabase 匿名密钥

### 6. Context7 服务器 (context7)
- **包名**: `@upstash/context7-mcp`
- **功能**: Context7 向量数据库操作
- **需要配置**:
  - `CONTEXT7_API_KEY`: 您的 Context7 API 密钥
- **用途**: 
  - 向量搜索
  - 语义相似性查询
  - 文档检索
  - 知识库管理

## 🔧 配置 Context7

要使用 Context7 MCP 服务器，您需要：

1. **获取 Context7 API 密钥**:
   - 访问 Context7 官网
   - 注册/登录账户
   - 创建 API 密钥

2. **更新配置文件**:
   ```json
   "context7": {
     "command": "npx",
     "args": [
       "-y",
       "@upstash/context7-mcp"
     ],
     "env": {
       "CONTEXT7_API_KEY": "your-context7-api-key-here"
     }
   }
   ```

## 🔧 配置 Supabase

要使用 Supabase MCP 服务器，您需要：

1. **获取 Supabase 凭据**:
   - 登录您的 Supabase 项目
   - 进入 Settings > API
   - 复制 Project URL 和 anon public key

2. **更新配置文件**:
   ```json
   "supabase": {
     "command": "npx",
     "args": [
       "-y",
       "@supabase/mcp-server-supabase"
     ],
     "env": {
       "SUPABASE_URL": "https://your-project.supabase.co",
       "SUPABASE_ANON_KEY": "your-anon-key-here"
     }
   }
   ```

## 🚀 使用示例

### 文件系统操作
```
"在我的桌面上创建一个测试文件"
"查看文档文件夹中的内容"
"搜索所有 PDF 文件"
```

### Git 操作
```
"显示当前 Git 状态"
"查看最近的提交历史"
"创建新分支"
```

### 网络搜索
```
"搜索最新的技术新闻"
"查找 React 18 新特性"
"获取当前天气信息"
```

### 浏览器自动化
```
"打开网页并截图"
"填写表单并提交"
"爬取网页内容"
```

### 数据库操作
```
"查询用户表数据"
"插入新记录"
"更新用户信息"
```

### Context7 向量搜索
```
"搜索相似的文档"
"查找相关内容"
"语义相似性查询"
"知识库检索"
```

## 🔄 重启和验证

1. **重启 Claude Desktop**:
   - 完全退出 (Cmd + Q)
   - 重新启动

2. **验证功能**:
   - 检查输入框左下角的工具图标
   - 尝试各种操作命令
   - 查看错误日志（如有问题）

## 📁 日志文件位置

- 主日志: `~/Library/Logs/Claude/mcp.log`
- 文件系统: `~/Library/Logs/Claude/mcp-server-filesystem.log`
- Git: `~/Library/Logs/Claude/mcp-server-git.log`
- Brave 搜索: `~/Library/Logs/Claude/mcp-server-brave-search.log`
- Playwright: `~/Library/Logs/Claude/mcp-server-playwright.log`
- Supabase: `~/Library/Logs/Claude/mcp-server-supabase.log`
- Context7: `~/Library/Logs/Claude/mcp-server-context7.log`

## 🛠️ 故障排除

### 常见问题：
1. **服务器连接失败**: 检查网络连接和包名
2. **权限错误**: 确保 Claude Desktop 有必要的系统权限
3. **API 密钥错误**: 验证 API 密钥是否正确
4. **JSON 语法错误**: 使用 `python3 -m json.tool` 验证配置文件

### 查看日志：
```bash
tail -f ~/Library/Logs/Claude/mcp.log
```
