# 使用官方Node.js 20镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /code

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 安装运行时依赖
RUN npm install express http-proxy-middleware

# 暴露端口
EXPOSE 9000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=9000

# 启动命令
CMD ["node", "index.js"]
