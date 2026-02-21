#!/bin/bash
# Wrapper script for launchd — loads .env and runs the bot

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Source .env file, exporting each variable
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Find node — check common locations
NODE_BIN=$(command -v node 2>/dev/null || echo "")
if [ -z "$NODE_BIN" ]; then
  for p in /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    if [ -x "$p" ]; then NODE_BIN="$p"; break; fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node not found" >&2
  exit 1
fi

exec "$NODE_BIN" dist/bot.js
