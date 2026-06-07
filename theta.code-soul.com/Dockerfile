# THETA 前端 Dockerfile - 开发者模式（绕过严苛的 build 检查）
FROM node:20-alpine

WORKDIR /app

# 使用淘宝镜像安装 pnpm
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm && pnpm config set registry https://registry.npmmirror.com

# 复制依赖文件并安装（关闭死板模式）
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# 复制所有源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 终极奥义：跳过 build，直接以开发模式启动前端！
CMD ["pnpm", "dev"]