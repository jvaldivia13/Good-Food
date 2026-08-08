#!/usr/bin/env bash
# stop.sh — Detiene el servidor Food-Good
PIDFILE=/tmp/foodgood.pid
if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "✅ Food-Good detenido (PID $PID)"
    rm -f "$PIDFILE"
  else
    echo "No había proceso activo (PID $PID no existe); limpiando PID file."
    rm -f "$PIDFILE"
  fi
else
  # Fallback: matar por nombre
  pkill -f "node server/index.js" 2>/dev/null && echo "✅ Procesos Food-Good detenidos" || echo "No hay Food-Good corriendo."
fi
