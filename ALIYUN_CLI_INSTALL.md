# 阿里云CLI安装指南

## 🚀 安装方法

### 方法1: 使用Homebrew (推荐)

```bash
# 安装Homebrew (如果未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装阿里云CLI
brew install aliyun-cli
```

### 方法2: 手动下载安装

#### macOS (Intel)
```bash
# 下载
curl -o aliyun-cli-macos-latest-amd64.tgz https://aliyuncli.alicdn.com/aliyun-cli-macos-latest-amd64.tgz

# 解压
tar -xzf aliyun-cli-macos-latest-amd64.tgz

# 移动到系统路径
sudo mv aliyun /usr/local/bin/

# 验证安装
aliyun --version
```

#### macOS (Apple Silicon)
```bash
# 下载
curl -o aliyun-cli-macos-latest-arm64.tgz https://aliyuncli.alicdn.com/aliyun-cli-macos-latest-arm64.tgz

# 解压
tar -xzf aliyun-cli-macos-latest-arm64.tgz

# 移动到系统路径
sudo mv aliyun /usr/local/bin/

# 验证安装
aliyun --version
```

### 方法3: 从官网下载

访问 [阿里云CLI官网](https://help.aliyun.com/zh/cli/) 下载适合您系统的安装包。

## ⚙️ 配置

安装完成后，配置阿里云CLI：

```bash
aliyun configure
```

按提示输入：
- **AccessKey ID**: 您的阿里云AccessKey ID
- **AccessKey Secret**: 您的阿里云AccessKey Secret  
- **Default Region**: `cn-shanghai`
- **Default Output Format**: `json`

## 🔑 获取AccessKey

1. 登录 [阿里云控制台](https://console.aliyun.com/)
2. 点击右上角头像 → **AccessKey 管理**
3. 创建AccessKey (建议创建RAM用户的AccessKey)
4. 记录AccessKey ID和Secret

## 🧪 测试安装

```bash
# 检查版本
aliyun --version

# 检查配置
aliyun configure list

# 测试连接
aliyun ecs DescribeRegions --RegionId cn-shanghai
```

## 📋 权限要求

确保您的AccessKey具有以下权限：
- Supabase相关服务的访问权限
- 函数计算(FC)的读取权限
- 数据库服务的访问权限

## 🔧 故障排除

### 常见问题

1. **命令未找到**
   - 检查PATH环境变量
   - 确认文件已移动到正确位置

2. **权限不足**
   - 检查AccessKey权限
   - 确认RAM用户权限配置

3. **网络连接问题**
   - 检查网络连接
   - 确认防火墙设置

## 📚 更多信息

- [阿里云CLI官方文档](https://help.aliyun.com/zh/cli/)
- [阿里云Supabase文档](https://help.aliyun.com/zh/supabase/)
- [函数计算文档](https://help.aliyun.com/zh/fc/)

---

**安装完成后，您就可以使用阿里云CLI管理Supabase实例了！** 🎉
