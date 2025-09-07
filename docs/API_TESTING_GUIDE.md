# 企业微信登录API测试指南

## 🧪 测试概述

本文档提供了企业微信登录API的完整测试指南，包括功能测试、性能测试和安全测试。

## 🚀 部署状态

- **部署状态**: ✅ 已部署并运行正常
- **API地址**: `https://lead-service.vld.com.cn/api`
- **部署时间**: 2025-09-07 13:00
- **最后更新**: 2025-09-07 14:41

## 🔧 测试环境

### 测试服务器
```bash
服务器IP: 8.159.132.181
API域名: lead-service.vld.com.cn/api
测试端口: 443 (HTTPS)
```

### 测试工具
- **curl**: 命令行HTTP客户端
- **Postman**: GUI API测试工具
- **Jest**: JavaScript测试框架
- **Artillery**: 性能测试工具

## 📋 功能测试

### 1. 健康检查测试

#### 测试用例
```bash
# 测试健康检查接口
curl -X GET https://lead-service.vld.com.cn/api/api/health \
  -H "Accept: application/json" \
  -v
```

#### 预期结果
```json
{
  "success": true,
  "message": "企业微信认证API服务运行正常",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 测试脚本
```bash
#!/bin/bash
# health-check-test.sh

echo "🔍 测试健康检查接口..."

response=$(curl -s -w "%{http_code}" https://lead-service.vld.com.cn/api/api/health)
http_code="${response: -3}"
body="${response%???}"

if [ "$http_code" = "200" ]; then
    echo "✅ 健康检查通过 (HTTP $http_code)"
    echo "📄 响应内容: $body"
else
    echo "❌ 健康检查失败 (HTTP $http_code)"
    echo "📄 响应内容: $body"
    exit 1
fi
```

### 2. 获取授权URL测试

#### 测试用例
```bash
# 测试获取授权URL
curl -X GET https://lead-service.vld.com.cn/api/api/auth/wecom/url \
  -H "Accept: application/json" \
  -v
```

#### 预期结果
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
    "state": "wecom_auth_1234567890"
  }
}
```

#### 验证要点
- [ ] 返回状态码200
- [ ] 响应格式正确
- [ ] authUrl包含正确的企业微信域名
- [ ] state参数格式正确
- [ ] 包含所有必要的OAuth参数

### 3. 获取二维码测试

#### 测试用例
```bash
# 测试获取二维码
curl -X GET https://lead-service.vld.com.cn/api/api/auth/wecom/qrcode \
  -H "Accept: application/json" \
  -v
```

#### 预期结果
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
    "state": "qrcode_1234567890_abc123"
  }
}
```

#### 验证要点
- [ ] 返回状态码200
- [ ] 响应格式正确
- [ ] state参数包含"qrcode_"前缀
- [ ] authUrl可访问

### 4. 状态检查测试

#### 测试用例
```bash
# 测试状态检查（使用无效state）
curl -X GET "https://lead-service.vld.com.cn/api/api/auth/wecom/status?state=invalid_state" \
  -H "Accept: application/json" \
  -v
```

#### 预期结果
```json
{
  "success": false,
  "error": "状态不存在或已过期"
}
```

#### 验证要点
- [ ] 无效state返回404或400
- [ ] 错误信息清晰
- [ ] 响应格式正确

## 🔒 安全测试

### 1. 输入验证测试

#### SQL注入测试
```bash
# 测试SQL注入
curl -X POST https://lead-service.vld.com.cn/api/api/auth/wecom/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "'; DROP TABLE users; --",
    "state": "test_state"
  }'
```

#### XSS测试
```bash
# 测试XSS
curl -X POST https://lead-service.vld.com.cn/api/api/auth/wecom/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "<script>alert('xss')</script>",
    "state": "test_state"
  }'
```

### 2. 认证测试

#### 未授权访问测试
```bash
# 测试未授权访问
curl -X GET https://lead-service.vld.com.cn/api/api/auth/wecom/status \
  -H "Accept: application/json"
```

#### 跨域测试
```bash
# 测试CORS
curl -X GET https://lead-service.vld.com.cn/api/api/health \
  -H "Origin: https://malicious-site.com" \
  -H "Accept: application/json" \
  -v
```

### 3. 速率限制测试

#### 测试脚本
```bash
#!/bin/bash
# rate-limit-test.sh

echo "🚀 测试速率限制..."

for i in {1..110}; do
    response=$(curl -s -w "%{http_code}" https://lead-service.vld.com.cn/api/api/health)
    http_code="${response: -3}"
    
    if [ "$http_code" = "429" ]; then
        echo "✅ 速率限制生效 (请求 $i, HTTP $http_code)"
        break
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
        echo "📊 已发送 $i 个请求..."
    fi
done
```

## ⚡ 性能测试

### 1. 响应时间测试

#### 测试脚本
```bash
#!/bin/bash
# response-time-test.sh

echo "⏱️  测试响应时间..."

for i in {1..10}; do
    start_time=$(date +%s%N)
    curl -s https://lead-service.vld.com.cn/api/api/health > /dev/null
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 ))
    echo "请求 $i: ${duration}ms"
done
```

### 2. 并发测试

#### 使用Apache Bench
```bash
# 安装ab工具
yum install -y httpd-tools

# 并发测试
ab -n 1000 -c 10 https://lead-service.vld.com.cn/api/api/health
```

#### 使用wrk
```bash
# 安装wrk
git clone https://github.com/wg/wrk.git
cd wrk && make

# 并发测试
./wrk -t12 -c400 -d30s https://lead-service.vld.com.cn/api/api/health
```

### 3. 负载测试

#### Artillery配置
```yaml
# artillery-config.yml
config:
  target: 'https://lead-service.vld.com.cn/api'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 20
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Health Check"
    weight: 70
    flow:
      - get:
          url: "/api/health"
  - name: "Get Auth URL"
    weight: 20
    flow:
      - get:
          url: "/api/auth/wecom/url"
  - name: "Get QR Code"
    weight: 10
    flow:
      - get:
          url: "/api/auth/wecom/qrcode"
```

#### 运行负载测试
```bash
# 安装Artillery
npm install -g artillery

# 运行测试
artillery run artillery-config.yml
```

## 🔍 监控测试

### 1. 服务状态监控

#### 测试脚本
```bash
#!/bin/bash
# service-monitor.sh

echo "📊 监控服务状态..."

# 检查PM2状态
pm2_status=$(pm2 jlist | jq '.[0].pm2_env.status')
echo "PM2状态: $pm2_status"

# 检查Nginx状态
nginx_status=$(systemctl is-active nginx)
echo "Nginx状态: $nginx_status"

# 检查端口监听
port_80=$(netstat -tlnp | grep ":80 " | wc -l)
port_443=$(netstat -tlnp | grep ":443 " | wc -l)
port_3001=$(netstat -tlnp | grep ":3001 " | wc -l)

echo "端口80监听: $port_80"
echo "端口443监听: $port_443"
echo "端口3001监听: $port_3001"

# 检查API响应
api_response=$(curl -s -w "%{http_code}" https://lead-service.vld.com.cn/api/api/health)
http_code="${api_response: -3}"
echo "API响应状态: $http_code"
```

### 2. 资源使用监控

#### 测试脚本
```bash
#!/bin/bash
# resource-monitor.sh

echo "💻 监控资源使用..."

# CPU使用率
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "CPU使用率: ${cpu_usage}%"

# 内存使用率
memory_usage=$(free | grep Mem | awk '{printf("%.2f%%", $3/$2 * 100.0)}')
echo "内存使用率: $memory_usage"

# 磁盘使用率
disk_usage=$(df -h / | awk 'NR==2{print $5}')
echo "磁盘使用率: $disk_usage"

# 网络连接数
connections=$(netstat -an | grep ESTABLISHED | wc -l)
echo "网络连接数: $connections"
```

## 📊 测试报告模板

### 测试结果记录
```markdown
# 企业微信登录API测试报告

## 测试信息
- 测试日期: 2024-01-01
- 测试环境: 生产环境
- 测试人员: 测试团队
- API版本: v1.0.0

## 功能测试结果
| 测试用例 | 状态 | 响应时间 | 备注 |
|---------|------|----------|------|
| 健康检查 | ✅ 通过 | 50ms | 正常 |
| 获取授权URL | ✅ 通过 | 100ms | 正常 |
| 获取二维码 | ✅ 通过 | 120ms | 正常 |
| 状态检查 | ✅ 通过 | 80ms | 正常 |

## 安全测试结果
| 测试类型 | 状态 | 备注 |
|---------|------|------|
| SQL注入 | ✅ 通过 | 无漏洞 |
| XSS攻击 | ✅ 通过 | 无漏洞 |
| 速率限制 | ✅ 通过 | 正常限制 |
| CORS配置 | ✅ 通过 | 配置正确 |

## 性能测试结果
| 指标 | 结果 | 标准 | 状态 |
|------|------|------|------|
| 平均响应时间 | 80ms | <200ms | ✅ 通过 |
| 95%响应时间 | 150ms | <500ms | ✅ 通过 |
| 并发用户数 | 100 | >50 | ✅ 通过 |
| 错误率 | 0% | <1% | ✅ 通过 |

## 问题记录
无问题发现

## 建议
1. 定期进行性能测试
2. 监控API响应时间
3. 定期更新安全补丁
```

## 🚀 自动化测试

### CI/CD集成
```yaml
# .github/workflows/api-test.yml
name: API Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run API tests
      run: npm test
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Run performance tests
      run: npm run test:performance
```

## 📞 测试支持

### 测试环境访问
- **测试服务器**: 8.159.132.181
- **测试域名**: lead-service.vld.com.cn/api
- **测试账号**: 请联系管理员

### 测试工具下载
- [Postman](https://www.postman.com/downloads/)
- [Artillery](https://artillery.io/docs/getting-started/)
- [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html)

### 问题反馈
如发现测试问题，请提供：
1. 测试用例描述
2. 实际结果
3. 预期结果
4. 错误日志
5. 测试环境信息
