#!/bin/bash
# Install telegram-file-agent as a launchd daemon
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LABEL="com.lapp.telegram-file-agent"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/telegram-file-agent"

echo "==> Building..."
cd "$PROJECT_DIR"
npm run build

echo "==> Creating log directory..."
mkdir -p "$LOG_DIR"

echo "==> Generating launchd plist..."
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$PROJECT_DIR/scripts/run.sh</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
PLIST

echo "==> Stopping existing service (if any)..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true

echo "==> Starting service..."
launchctl load "$PLIST_PATH"

sleep 2
if launchctl list | grep -q "$LABEL"; then
  echo "==> Service installed and running!"
  echo "    Logs: tail -f $LOG_DIR/stdout.log $LOG_DIR/stderr.log"
else
  echo "==> WARNING: Service may not have started. Check logs at $LOG_DIR/"
fi
