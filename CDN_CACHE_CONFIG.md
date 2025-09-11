# CRM Web CDN缓存配置指南

## 📋 概述

本文档基于CRM Web前端项目的实际构建结构，提供详细的CDN缓存配置规则。项目使用Vite构建，包含React + TypeScript + Ant Design技术栈。

## 🏗️ 项目构建结构

### 实际构建输出结构
```
dist/
├── index.html                    # 主页面 (3.83 kB)
├── assets/
│   ├── css/
│   │   └── index-CbNzvLbC.css   # 样式文件 (260.04 kB)
│   ├── js/
│   │   ├── antd-BSvLjLvS.js     # Ant Design (1.34 MB)
│   │   ├── charts-DxC8cc-_.js   # 图表库 (1.17 MB)
│   │   ├── index-2-1z3l4B.js    # 主应用 (2.69 MB)
│   │   ├── supabase-D0hzhjQg.js # Supabase (114 kB)
│   │   ├── utils-BU6BcwI2.js    # 工具函数 (57 B)
│   │   └── vendor-CpJG26Rf.js   # React等 (140 kB)
│   └── worker-B7OCbMM3.js       # Web Worker (301 kB)
├── fonts/                        # 字体文件
├── achievement_card.svg          # SVG图标
├── coin.json                     # 数据文件
├── favicon.svg                   # 网站图标
└── notification.wav              # 音频文件
```

### 文件大小分析
- **最大文件**: `index-2-1z3l4B.js` (2.69 MB) - 主应用代码
- **第二大**: `antd-BSvLjLvS.js` (1.34 MB) - Ant Design组件库
- **第三大**: `charts-DxC8cc-_.js` (1.17 MB) - 图表库

## 🎯 CDN缓存规则配置

### 权重分配原则
- **权重范围**: 1-99（数字越大优先级越高）
- **匹配顺序**: 权重高的规则优先匹配
- **冲突处理**: 高权重规则覆盖低权重规则

## 📝 详细缓存规则

### 1. 静态资源文件（最高优先级 - 权重95-99）

#### 规则1: 字体文件
```
类型: 文件后缀名
地址: ttf,woff,woff2
权重: 99
过期时间: 365天
优先遵循源站缓存: 开启
忽略源站不缓存: 开启
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 字体文件，长期不变
文件示例: BitcountPropDouble-Light.ttf, Micro5-Regular.ttf
```

#### 规则2: SVG图标
```
类型: 文件后缀名
地址: svg
权重: 98
过期时间: 180天
优先遵循源站缓存: 开启
忽略源站不缓存: 开启
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 图标文件，变化频率低
文件示例: achievement_card.svg, favicon.svg, VLINKER.svg
```

#### 规则3: 音频文件
```
类型: 文件后缀名
地址: wav,mp3
权重: 97
过期时间: 180天
优先遵循源站缓存: 开启
忽略源站不缓存: 开启
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 音频文件，长期不变
文件示例: notification.wav
```

#### 规则4: JSON数据
```
类型: 文件后缀名
地址: json
权重: 96
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 数据文件，可能更新
文件示例: coin.json, points.json
```

### 2. 构建后的资源文件（高优先级 - 权重85-94）

#### 规则5: CSS文件
```
类型: 文件后缀名
地址: css
权重: 94
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 样式文件，有哈希保护
文件示例: index-CbNzvLbC.css
```

#### 规则6: JavaScript文件
```
类型: 文件后缀名
地址: js
权重: 93
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 脚本文件，有哈希保护
文件示例: index-2-1z3l4B.js, antd-BSvLjLvS.js, charts-DxC8cc-_.js
```

#### 规则7: Web Worker
```
类型: 文件后缀名
地址: js
权重: 92
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: Web Worker文件，有哈希保护
文件示例: worker-B7OCbMM3.js
```

### 3. 目录级缓存规则（中等优先级 - 权重70-84）

#### 规则8: fonts目录
```
类型: 目录
地址: /fonts/
权重: 84
过期时间: 365天
优先遵循源站缓存: 开启
忽略源站不缓存: 开启
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 字体文件目录，长期缓存
```

#### 规则9: assets目录
```
类型: 目录
地址: /assets/
权重: 83
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 构建资源目录
```

#### 规则10: assets/js目录
```
类型: 目录
地址: /assets/js/
权重: 82
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: JavaScript文件目录
```

#### 规则11: assets/css目录
```
类型: 目录
地址: /assets/css/
权重: 81
过期时间: 30天
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: CSS文件目录
```

### 4. 页面文件（低优先级 - 权重20-69）

#### 规则12: HTML文件
```
类型: 文件后缀名
地址: html,htm
权重: 69
过期时间: 1小时
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 页面文件，平衡性能和实时性
文件示例: index.html
```

#### 规则13: 根目录
```
类型: 目录
地址: /
权重: 20
过期时间: 1小时
优先遵循源站缓存: 开启
忽略源站不缓存: 关闭
客户端跟随CDN: 开启
强制内容重新验证: 关闭
说明: 主页面
```

### 5. API接口（最低优先级 - 权重1-19）

#### 规则14: API接口
```
类型: 目录
地址: /api/
权重: 9
过期时间: 0秒
优先遵循源站缓存: 关闭
忽略源站不缓存: 关闭
客户端跟随CDN: 关闭
强制内容重新验证: 不适用
说明: 动态接口，不缓存
```

## 🔧 配套Nginx配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/crm-web;
    index index.html;

    # 字体文件 - 长期缓存
    location ~* \.(ttf|woff|woff2|eot|otf)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # SVG图标 - 长期缓存
    location ~* \.svg$ {
        expires 180d;
        add_header Cache-Control "public, immutable";
    }

    # 音频文件 - 长期缓存
    location ~* \.(wav|mp3|ogg|m4a)$ {
        expires 180d;
        add_header Cache-Control "public, immutable";
    }

    # JSON数据 - 中期缓存
    location ~* \.json$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # CSS文件 - 中期缓存
    location ~* \.css$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # JavaScript文件 - 中期缓存
    location ~* \.js$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # fonts目录 - 长期缓存
    location /fonts/ {
        expires 365d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # assets目录 - 中期缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # API接口 - 不缓存
    location /api/ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        proxy_pass http://localhost:3001;
    }

    # 主页面 - 短期缓存
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

## 📊 预期效果

### 性能指标
- **CDN命中率**: 90%以上
- **页面加载速度**: 首次访问后提升60-80%
- **服务器压力**: 减少源站回源请求
- **用户体验**: 页面切换更流畅

### 缓存策略优势
1. **文件哈希保护**: Vite构建时已为文件添加哈希值，确保版本控制
2. **代码分割优化**: 按功能模块分割，便于缓存管理
3. **大文件优先**: 由于文件较大，缓存收益明显
4. **平衡性能**: 在性能和实时性之间找到最佳平衡点

## 🔍 监控和验证

### 1. 测试访问
```bash
# 测试静态资源
curl -I https://your-domain.com/assets/js/index-2-1z3l4B.js
curl -I https://your-domain.com/assets/css/index-CbNzvLbC.css
curl -I https://your-domain.com/fonts/BitcountPropDouble-Light.ttf

# 测试API接口
curl -I https://your-domain.com/api/users
```

### 2. 检查响应头
```
# 静态资源应该返回
Cache-Control: max-age=2592000  # 30天
Cache-Control: max-age=15552000 # 180天
Cache-Control: max-age=31536000 # 365天

# API接口应该返回
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
```

### 3. 性能监控
- **CDN控制台**: 查看缓存命中率
- **浏览器开发者工具**: 监控资源加载时间
- **日志分析**: 关注源站回源频率

## ⚠️ 注意事项

### 1. 配置顺序
- 确保高权重规则在低权重规则之前
- 文件后缀名规则优先于目录规则
- API规则必须设置为最低权重

### 2. 文件后缀名格式
- 使用不带点号的格式：`css,js,svg` 而不是 `.css,.js,.svg`
- 多个后缀用半角逗号分隔：`ttf,woff,woff2`
- 不要有空格：`css,js` 而不是 `css, js`

### 3. 强制内容重新验证
- 建议所有规则都关闭"强制内容重新验证"
- 原因：项目已有完善的版本控制（文件哈希）
- 可以最大化CDN性能优势

### 4. 环境变量
- 确保CDN配置与生产环境匹配
- 定期检查缓存规则是否生效
- 监控CDN费用和性能指标

## 🚀 部署步骤

### 1. 在阿里云CDN控制台配置
1. 登录阿里云CDN控制台
2. 选择对应的加速域名
3. 进入"缓存配置"页面
4. 按照上述规则逐一添加缓存规则
5. 保存配置并等待生效（通常5-10分钟）

### 2. 验证配置
1. 清除浏览器缓存
2. 访问网站并检查网络面板
3. 确认静态资源从CDN加载
4. 检查响应头中的缓存信息

### 3. 监控优化
1. 观察CDN命中率变化
2. 监控页面加载速度
3. 分析用户访问体验
4. 根据实际情况调整缓存策略

## 📞 支持

如有问题，请检查：
1. CDN配置是否正确保存
2. 缓存规则权重是否合理
3. 文件后缀名格式是否正确
4. 强制内容重新验证是否关闭
5. 监控CDN控制台的缓存命中率

---

**文档版本**: 1.0.0  
**创建时间**: 2025-09-11  
**适用项目**: CRM Web Frontend  
**构建工具**: Vite + React + TypeScript  
**状态**: 生产就绪
