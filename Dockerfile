FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py ./
COPY seed_users.jso[n] ./
COPY web ./web
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /data && chmod 755 /usr/local/bin/docker-entrypoint.sh && chmod -R a+rX /app
# 以 root 進入，entrypoint 會降權成 /data 擁有者（root 擁有則改 chown 成 1000）
ENV DATA_DIR=/data TZ=Asia/Taipei
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3)"
# 單一 worker:登入失敗計數放在程序記憶體內；僅信任本機與 Docker 內網反向代理標頭
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1,::1,172.16.0.0/12,10.0.0.0/8"]
