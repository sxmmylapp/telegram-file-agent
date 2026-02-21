#!/bin/bash
# Uninstall telegram-file-agent launchd daemon
set -euo pipefail

LABEL="com.lapp.telegram-file-agent"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "==> Stopping service..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true

echo "==> Removing plist..."
rm -f "$PLIST_PATH"

echo "==> Service uninstalled."
echo "    Logs remain at ~/Library/Logs/telegram-file-agent/"
