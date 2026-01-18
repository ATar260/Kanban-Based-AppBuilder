#!/bin/zsh
# Open Lovable - Stop All Services (macOS/Linux shell)
# Usage: ./stop-all-services.sh

set -e

PORT=3002

echo ""
echo "========================================"
echo "  Open Lovable - Stopping Services"
echo "========================================"
echo ""

echo "[*] Looking for processes on port ${PORT}..."

if ! command -v lsof >/dev/null 2>&1; then
  echo "[!] 'lsof' not found; can't reliably stop by port."
  echo "    On macOS you can install it via: xcode-select --install (or ensure Command Line Tools are installed)"
  exit 1
fi

pids="$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"

stopped=0

if [ -n "${pids}" ]; then
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
fi

echo ""
if [ "${stopped}" -gt 0 ]; then
  echo "[OK] Stopped ${stopped} process(es)"
else
  echo "[OK] No running services found"
fi
echo ""

