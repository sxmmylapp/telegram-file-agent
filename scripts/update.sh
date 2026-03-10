#!/bin/bash
# Update Telegram File Agent to the latest version
set -euo pipefail

INSTALL_DIR="$HOME/telegram-file-agent"

echo "==> Updating Telegram File Agent..."
cd "$INSTALL_DIR"
git pull origin main
npm install
bash scripts/install.sh
echo "==> Update complete!"
