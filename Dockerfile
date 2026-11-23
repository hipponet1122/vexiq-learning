FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" itsdangerous
COPY server.py ./
COPY seed_users.jso[n] ./
COPY web ./web
RUN chmod -R a+rX /app
ENV DATA_DIR=/data TZ=Asia/Taipei
EXPOSE 8000
# 單一 worker:登入失敗計數放在程序記憶體內
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
