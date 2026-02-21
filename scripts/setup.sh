#!/bin/bash
# One-time setup for telegram-file-agent on a fresh Mac
# Usage: git clone <repo> && cd telegram-file-agent && bash scripts/setup.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Telegram File Agent Setup ==="
echo ""

# 1. Check for Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it with: brew install node"
  echo "Or download from: https://nodejs.org"
  exit 1
fi
echo "[ok] Node.js $(node --version)"

# 2. Install dependencies
echo ""
echo "==> Installing dependencies..."
npm install

# 3. Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "==> Creating .env file..."
  echo "You'll need a few values. Ask Sammy if you don't have them."
  echo ""

  read -p "Bot token (from @BotFather): " BOT_TOKEN
  read -p "Authorized Telegram user IDs (comma-separated): " AUTH_IDS
  read -p "Anthropic API key: " ANTHROPIC_KEY

  cat > .env <<ENV
BOT_TOKEN=$BOT_TOKEN
AUTHORIZED_USER_IDS=$AUTH_IDS
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
CLAUDE_MODEL=claude-sonnet-4-6
NODE_ENV=production
LOG_LEVEL=info
ENV

  echo "[ok] .env created"
else
  echo "[ok] .env already exists"
fi

# 4. Build
echo ""
echo "==> Building..."
npm run build

# 5. Install launchd service
echo ""
echo "==> Installing as background service..."
bash scripts/install.sh

echo ""
echo "=== Setup complete! ==="
echo ""
echo "The bot is now running and will auto-start on login."
echo ""
echo "Commands:"
echo "  npm run logs              — View live logs"
echo "  npm run install-service   — Rebuild and restart"
echo "  npm run uninstall-service — Stop and remove"
echo ""
