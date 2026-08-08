#!/usr/bin/env bash
# start.sh — Levanta el servidor Food-Good (si ya corre, lo ignora)
cd "$(dirname "$0")"
PIDFILE=/tmp/foodgood.pid
PORT="${PORT:-3000}"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Food-Good ya está corriendo (PID $(cat "$PIDFILE"))"
  echo "Abre: http://192.168.18.13:${PORT}"
  exit 0
fi

# Asegurar seed si no hay BD
[ -f data/db.json ] || node server/seed.js

nohup node server/index.js > /tmp/foodgood.log 2>&1 &
echo $! > "$PIDFILE"
sleep 2
echo "✅ Food-Good levantado en http://192.168.18.13:${PORT}"
echo "   PINs: admin=2222 · mozo=3333 · cocina=5555 · cajero=4444"
echo "   Log: /tmp/foodgood.log"
