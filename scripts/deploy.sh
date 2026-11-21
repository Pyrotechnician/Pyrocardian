#!/usr/bin/env bash
# Pyrocardian 部署脚本（无需 root，单端口 IP 访问）
# 用法: bash scripts/deploy.sh {start|stop|restart|status|logs}
# 环境变量: PORT(默认 12345) HOST(默认 0.0.0.0) DB_PATH(默认 data/pyrocardian.db)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-12345}"
HOST="${HOST:-0.0.0.0}"
DATA_DIR="$(pwd)/data"
PID_FILE="$DATA_DIR/server.pid"
LOG_FILE="$DATA_DIR/server.log"
DB_PATH="${DB_PATH:-$DATA_DIR/pyrocardian.db}"

mkdir -p "$DATA_DIR"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

health_ok() {
  node -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null
}

wait_health() {
  for _ in $(seq 1 30); do
    if health_ok; then return 0; fi
    sleep 1
  done
  return 1
}

do_stop() {
  if is_running; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    for _ in $(seq 1 10); do
      is_running || break
      sleep 0.5
    done
    if is_running; then kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true; fi
  fi
  rm -f "$PID_FILE"
}

do_start() {
  if is_running && health_ok; then
    echo "already running (pid $(cat "$PID_FILE")) at http://$HOST:$PORT"
    return 0
  fi
  do_stop
  echo "==> npm ci"
  npm ci --no-audit --no-fund
  echo "==> npm run build"
  npm run build
  echo "==> starting server on $HOST:$PORT (db: $DB_PATH)"
  PORT="$PORT" HOST="$HOST" DB_PATH="$DB_PATH" nohup npx tsx apps/server/src/index.ts >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  if wait_health; then
    echo "==> OK: http://<服务器IP>:$PORT  (pid $(cat "$PID_FILE"), log: $LOG_FILE, db: $DB_PATH)"
  else
    echo "==> FAILED to become healthy, last log lines:" >&2
    tail -20 "$LOG_FILE" >&2 || true
    exit 1
  fi
}

do_status() {
  if is_running; then
    if health_ok; then
      echo "running (pid $(cat "$PID_FILE")) — http://$HOST:$PORT healthy"
    else
      echo "process alive (pid $(cat "$PID_FILE")) but not healthy yet; check: bash scripts/deploy.sh logs"
    fi
  else
    echo "not running"
  fi
}

case "${1:-restart}" in
  start) do_start ;;
  stop) do_stop; echo "stopped" ;;
  restart) do_stop; do_start ;;
  status) do_status ;;
  logs) tail -f "$LOG_FILE" ;;
  *) echo "usage: bash scripts/deploy.sh {start|stop|restart|status|logs}"; exit 1 ;;
esac
