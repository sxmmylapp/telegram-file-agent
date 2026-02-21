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

exec /usr/local/bin/node dist/bot.js
