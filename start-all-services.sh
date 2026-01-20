#!/bin/zsh
# Paynto AI - Start All Services (macOS/Linux shell)
# Usage: ./start-all-services.sh

set -e

PORT=3002
DEV_URL="http://localhost:${PORT}"
# Turbopack can hit macOS file descriptor limits on large repos.
# Use Webpack by default for reliability (and bump ulimit best-effort).
DEV_CMD="ulimit -n 10000 2>/dev/null || true; WATCHPACK_POLLING=true npx next dev --webpack --port ${PORT}"

echo ""
echo "========================================"
echo "  Paynto AI - Starting Services"
echo "========================================"
echo ""

SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR"

if command -v sysctl >/dev/null 2>&1; then
  num_files="$(sysctl -n kern.num_files 2>/dev/null || true)"
  max_files="$(sysctl -n kern.maxfiles 2>/dev/null || true)"

  if [[ -n "${num_files}" && -n "${max_files}" ]]; then
    echo "[*] macOS open files: ${num_files}/${max_files}"

    # Warn if we're within ~500 file descriptors of the system limit.
    if (( num_files > max_files - 500 )); then
      echo "[!] System file table is nearly full. Next.js may fail with ENFILE."
      echo "    Close other watch processes, or increase limits temporarily:"
      echo "      sudo launchctl limit maxfiles 65536 200000"
      echo "      sudo sysctl -w kern.maxfiles=200000"
      echo "      sudo sysctl -w kern.maxfilesperproc=65536"
      echo ""
    exit 1
    fi
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "[!] node_modules not found. Running npm install..."
  npm install
fi

if [ ! -f ".env.local" ]; then
  echo "[!] Warning: .env.local not found."
  echo "    Create .env.local in the project root and set E2B_API_KEY (and optionally SANDBOX_PROVIDER=e2b, E2B_TEMPLATE_ID)."
  echo "    See PRODUCT_PLAN.md > PART 7: ENVIRONMENT VARIABLES."
fi

echo "[*] App will be available at: ${DEV_URL}"
echo ""

if command -v osascript >/dev/null 2>&1; then
  echo "[*] Starting Next.js dev server in a new Terminal window..."

  terminal_cmd="cd \"${SCRIPT_DIR}\" && echo 'Starting Next.js dev server with Webpack on port ${PORT}...' && echo 'Press Ctrl+C to stop the server' && ${DEV_CMD}"
  terminal_cmd="${terminal_cmd//\\/\\\\}"
  terminal_cmd="${terminal_cmd//\"/\\\"}"

  /usr/bin/osascript <<EOF >/dev/null
tell application "Terminal"
  activate
  do script "${terminal_cmd}"
end tell
EOF

  sleep 3
  if command -v open >/dev/null 2>&1; then
    open "${DEV_URL}" >/dev/null 2>&1 || true
  fi

  echo "[*] Dev server launched in a separate Terminal window."
  echo ""
else
  echo "[!] osascript not found. Starting dev server in this terminal instead..."
  echo "    ${DEV_CMD}"
  echo ""
  eval "${DEV_CMD}"
fi

