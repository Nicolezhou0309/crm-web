# 阿里云CLI安装指南

## 方法1：手动下载安装（推荐）

### 1. 下载阿里云CLI
访问：https://help.aliyun.com/zh/cli/

选择对应版本：
- macOS: https://aliyuncli.alicdn.com/aliyun-cli-macos-latest-amd64.tgz
- Linux: https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz
- Windows: https://aliyuncli.alicdn.com/aliyun-cli-windows-latest-amd64.zip

### 2. 安装步骤

#### macOS:
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

#### Linux:
```bash
# 下载
curl -o aliyun-cli-linux-latest-amd64.tgz https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz

# 解压
tar -xzf aliyun-cli-linux-latest-amd64.tgz

# 移动到系统路径
sudo mv aliyun /usr/local/bin/

# 验证安装
aliyun --version
```

## 方法2：使用包管理器

### macOS (Homebrew):
```bash
brew install aliyun-cli
```

### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install aliyun-cli
```

## 配置阿里云CLI

安装完成后，需要配置访问凭证：

```bash
aliyun configure
```

输入以下信息：
- AccessKey ID: 您的阿里云AccessKey ID
- AccessKey Secret: 您的阿里云AccessKey Secret
- Default Region: cn-shanghai（推荐）
- Default Output Format: json

## 获取AccessKey

1. 登录阿里云控制台
2. 访问：RAM访问控制 → 用户 → 创建AccessKey
3. 保存AccessKey ID和Secret

## 验证配置

```bash
# 测试配置
aliyun ecs DescribeRegions

# 如果成功，说明配置正确
```

## 常见问题

### 1. 权限问题
如果遇到权限问题，确保：
- AccessKey有足够的权限
- 用户有OSS访问权限

### 2. 网络问题
如果下载失败，可以：
- 使用VPN
- 手动下载文件
- 使用镜像源

### 3. 版本问题
确保下载的是最新版本，支持您需要的功能。
