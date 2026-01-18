#!/bin/zsh
# Open Lovable - Start All Services (macOS/Linux shell)
# Usage: ./start-all-services.sh

set -e

PORT=3002
DEV_URL="http://localhost:${PORT}"
DEV_CMD="npx next dev --turbopack --port ${PORT}"

echo ""
echo "========================================"
echo "  Open Lovable - Starting Services"
echo "========================================"
echo ""

SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR"

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

  terminal_cmd="cd \"${SCRIPT_DIR}\" && echo 'Starting Next.js dev server with Turbopack on port ${PORT}...' && echo 'Press Ctrl+C to stop the server' && ${DEV_CMD}"
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

