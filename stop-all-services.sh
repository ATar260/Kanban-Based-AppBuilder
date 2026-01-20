#!/bin/zsh
# Paynto AI - Stop All Services (macOS/Linux shell)
# Usage: ./stop-all-services.sh

set -e

PORTS=(3000 3002)

echo ""
echo "========================================"
echo "  Paynto AI - Stopping Services"
echo "========================================"
echo ""

echo "[*] Looking for dev server processes..."

if ! command -v lsof >/dev/null 2>&1; then
  echo "[!] 'lsof' not found; can't reliably stop by port."
  echo "    On macOS you can install it via: xcode-select --install (or ensure Command Line Tools are installed)"
  exit 1
fi

stopped=0

for PORT in ${PORTS[@]}; do
  pids="$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  if [ -z "${pids}" ]; then
    continue
  fi

  for pid in ${(f)pids}; do
    if [ -z "${pid}" ]; then
      continue
    fi

    echo "[*] Stopping process on port ${PORT} (PID: ${pid})"

    # Try graceful first, then force.
    kill "${pid}" 2>/dev/null || true
    sleep 0.5
    kill -9 "${pid}" 2>/dev/null || true

    stopped=$((stopped + 1))
  done
done

echo ""
if [ "${stopped}" -gt 0 ]; then
  echo "[OK] Stopped ${stopped} process(es)"
else
  echo "[OK] No running services found"
fi
echo ""

