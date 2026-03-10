#!/bin/bash
# One-liner setup for Telegram File Agent on a fresh Mac.
# Usage: curl -fsSL https://raw.githubusercontent.com/sxmmylapp/telegram-file-agent/main/scripts/setup-remote.sh | bash
#
# The script will prompt for credentials interactively.
# You can also pre-set them as env vars to skip prompts:
#   BOT_TOKEN="xxx" ANTHROPIC_API_KEY="yyy" TELEGRAM_USER_ID="zzz" curl ... | bash
set -euo pipefail

# ── Step 0: Collect credentials ──────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Telegram File Agent — Setup"
echo "============================================"
echo ""
echo "  You'll need 3 things:"
echo "    1. A Telegram Bot Token (from @BotFather)"
echo "    2. An Anthropic API Key (from console.anthropic.com)"
echo "    3. Your Telegram User ID (from @userinfobot)"
echo ""

# Read from /dev/tty so this works with curl | bash
prompt() {
  local var_name="$1" prompt_text="$2" current_val="${3:-}"
  if [ -n "$current_val" ]; then
    echo "    $prompt_text: (using pre-set value)"
  else
    printf "    $prompt_text: " >&2
    read -r current_val < /dev/tty
    if [ -z "$current_val" ]; then
      echo "ERROR: $var_name is required." >&2
      exit 1
    fi
  fi
  echo "$current_val"
}

BOT_TOKEN=$(prompt "BOT_TOKEN" "Telegram Bot Token" "${BOT_TOKEN:-}")
ANTHROPIC_API_KEY=$(prompt "ANTHROPIC_API_KEY" "Anthropic API Key" "${ANTHROPIC_API_KEY:-}")
TELEGRAM_USER_ID=$(prompt "TELEGRAM_USER_ID" "Your Telegram User ID" "${TELEGRAM_USER_ID:-}")

echo ""
echo "    All credentials collected."

# ── Step 1: Detect architecture ──────────────────────────────────────────────
echo "==> Step 1: Detecting architecture..."
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  HOMEBREW_PREFIX="/opt/homebrew"
  echo "    Apple Silicon (ARM64) detected."
else
  HOMEBREW_PREFIX="/usr/local"
  echo "    Intel (x86_64) detected."
fi

# ── Step 2: Install Homebrew ─────────────────────────────────────────────────
echo "==> Step 2: Checking Homebrew..."
if ! command -v "$HOMEBREW_PREFIX/bin/brew" &>/dev/null && ! command -v brew &>/dev/null; then
  echo "    Installing Homebrew (this may take a minute)..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for this session
  eval "$($HOMEBREW_PREFIX/bin/brew shellenv)"
  echo "    Homebrew installed."
else
  echo "    Homebrew already installed."
  # Ensure brew is in PATH
  if command -v "$HOMEBREW_PREFIX/bin/brew" &>/dev/null; then
    eval "$($HOMEBREW_PREFIX/bin/brew shellenv)"
  fi
fi

# ── Step 3: Install Node.js ──────────────────────────────────────────────────
echo "==> Step 3: Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "    Installing Node.js via Homebrew..."
  brew install node
  echo "    Node.js installed."
else
  echo "    Node.js already installed: $(node --version)"
fi

# Verify Node.js version is 20+
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "    Node.js v20+ required (found v$NODE_MAJOR). Upgrading..."
  brew upgrade node
fi

# ── Step 4: Install git ──────────────────────────────────────────────────────
echo "==> Step 4: Checking git..."
if ! command -v git &>/dev/null; then
  echo "    Installing git via Homebrew..."
  brew install git
  echo "    git installed."
else
  echo "    git already installed."
fi

# ── Step 5: Clone or update repo ─────────────────────────────────────────────
INSTALL_DIR="$HOME/telegram-file-agent"
echo "==> Step 5: Setting up repository..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "    Repo exists, pulling latest..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  echo "    Cloning repository..."
  git clone https://github.com/sxmmylapp/telegram-file-agent.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Step 6: Install dependencies ─────────────────────────────────────────────
echo "==> Step 6: Installing npm dependencies..."
npm install

# ── Step 7: Write .env ───────────────────────────────────────────────────────
echo "==> Step 7: Writing .env configuration..."
cat > "$INSTALL_DIR/.env" <<ENV
BOT_TOKEN=$BOT_TOKEN
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
AUTHORIZED_USER_IDS=$TELEGRAM_USER_ID
CLAUDE_MODEL=claude-sonnet-4-6
NODE_ENV=production
LOG_LEVEL=info
SEARCH_PATHS="$HOME/Desktop,$HOME/Documents,$HOME/Downloads,$HOME/Library/Mobile Documents/com~apple~CloudDocs"
ENV
echo "    .env written."

# ── Step 8: Build and install service ─────────────────────────────────────────
echo "==> Step 8: Building and installing launchd service..."
bash "$INSTALL_DIR/scripts/install.sh"

# ── Step 9: Verify ───────────────────────────────────────────────────────────
echo "==> Step 9: Verifying installation..."
sleep 3
LABEL="com.lapp.telegram-file-agent"
LOG_DIR="$HOME/Library/Logs/telegram-file-agent"

if launchctl list | grep -q "$LABEL"; then
  echo "    Service is running!"
else
  echo "    WARNING: Service may not have started. Check: tail -f $LOG_DIR/stderr.log"
fi

# Check for bot startup in logs
if [ -f "$LOG_DIR/stdout.log" ] && grep -q "Bot started" "$LOG_DIR/stdout.log" 2>/dev/null; then
  echo "    Bot started successfully!"
fi

# ── Done! ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Telegram File Agent — Setup Complete!"
echo "============================================"
echo ""
echo "  The bot is running and will auto-start on login."
echo ""
echo "  Next steps:"
echo "    1. Open Telegram and message your bot"
echo "    2. Send /start or /help to get started"
echo "    3. Send any document to get a summary"
echo "    4. Use /search <query> to search your files"
echo ""
echo "  Useful commands:"
echo "    View logs:    tail -f $LOG_DIR/stdout.log"
echo "    View errors:  tail -f $LOG_DIR/stderr.log"
echo "    Update bot:   bash $INSTALL_DIR/scripts/update.sh"
echo "    Stop bot:     launchctl unload ~/Library/LaunchAgents/$LABEL.plist"
echo "    Start bot:    launchctl load ~/Library/LaunchAgents/$LABEL.plist"
echo ""
echo "  IMPORTANT: If /search returns no results for files you know exist,"
echo "  grant Full Disk Access to Terminal:"
echo "    System Settings > Privacy & Security > Full Disk Access > Terminal"
echo ""
