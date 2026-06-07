# =============================================================================
# THETA Backend Dockerfile
# =============================================================================
# 用途: 构建后端 FastAPI 服务镜像
# 使用方式:
#   docker build -t theta-backend:latest -f theta_project/Dockerfile .
#   docker-compose up -d
# =============================================================================

FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# [修改点]：恢复正确的系统底层依赖安装（安装 curl 以便后面能进行健康检查）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true && \
    apt-get update && apt-get install -y --no-install-recommends curl gcc && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY requirements.txt .

# [修改点]：使用清华大学 PyPI 镜像源极速下载 Python 包，防止卡死
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制所有代码
COPY . .

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]