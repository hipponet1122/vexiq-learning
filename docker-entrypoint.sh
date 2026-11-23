#!/bin/sh
# 以 root 啟動，只做一件事：讓 /data 可寫，然後降權成「/data 的擁有者」執行。
# 這樣 NAS 上由家目錄使用者（非 UID 1000）擁有的 ./data 不用手動 chown 也能升級。
set -e
if [ "$(id -u)" = "0" ]; then
  U=$(stat -c %u /data)
  G=$(stat -c %g /data)
  if [ "$U" = "0" ]; then U=1000; G=1000; chown -R "$U:$G" /data; fi
  [ -f /app/seed_users.json ] && chown "$U:$G" /app/seed_users.json && chmod 600 /app/seed_users.json
  exec setpriv --reuid="$U" --regid="$G" --clear-groups "$@"
fi
exec "$@"
