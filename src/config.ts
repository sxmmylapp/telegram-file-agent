import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAuthorizedUserIds(raw: string): number[] {
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((id) => !isNaN(id));

  if (ids.length === 0) {
    throw new Error(
      "AUTHORIZED_USER_IDS must contain at least one valid numeric Telegram user ID"
    );
  }

  return ids;
}

const DEFAULT_SEARCH_PATHS = [
  `${process.env.HOME}/Library/Mobile Documents/com~apple~CloudDocs`,
  `${process.env.HOME}/Desktop`,
  `${process.env.HOME}/Documents`,
  `${process.env.HOME}/Downloads`,
];

function parseSearchPaths(): string[] {
  if (process.env.SEARCH_PATHS) {
    return process.env.SEARCH_PATHS.split(",").map((p) => p.trim()).filter(Boolean);
  }
  // Fallback: use ICLOUD_DRIVE_PATH if set (backwards compat), otherwise defaults
  if (process.env.ICLOUD_DRIVE_PATH) {
    return [process.env.ICLOUD_DRIVE_PATH];
  }
  return DEFAULT_SEARCH_PATHS;
}

export const config = {
  BOT_TOKEN: requireEnv("BOT_TOKEN"),
  AUTHORIZED_USER_IDS: parseAuthorizedUserIds(
    requireEnv("AUTHORIZED_USER_IDS")
  ),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  ANTHROPIC_API_KEY: requireEnv("ANTHROPIC_API_KEY"),
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  SEARCH_PATHS: parseSearchPaths(),
  ICLOUD_DRIVE_PATH:
    process.env.ICLOUD_DRIVE_PATH ||
    `${process.env.HOME}/Library/Mobile Documents/com~apple~CloudDocs`,
} as const;
