import { Bot, GrammyError, HttpError } from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { autoRetry } from "@grammyjs/auto-retry";

import { config } from "./config.js";
import { createLogger } from "./logger.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createLoggingMiddleware } from "./middleware/logging.js";
import { commandHandlers } from "./handlers/commands.js";
import { documentHandlers } from "./handlers/documents.js";
import type { BotContext } from "./types.js";

const logger = createLogger();
const bot = new Bot<BotContext>(config.BOT_TOKEN);

// API-level plugins
bot.api.config.use(hydrateFiles(bot.token));
bot.api.config.use(autoRetry());

// Global error handler (BOT-04)
bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  if (e instanceof GrammyError) {
    logger.error(
      { error: e, updateId: ctx.update.update_id, errorType: "GrammyError" },
      "Telegram API error"
    );
  } else if (e instanceof HttpError) {
    logger.error(
      { error: e, updateId: ctx.update.update_id, errorType: "HttpError" },
      "HTTP error communicating with Telegram"
    );
  } else {
    logger.error(
      { error: e, updateId: ctx.update.update_id, errorType: "Unknown" },
      "Unknown error in bot handler"
    );
  }

  // Reply to user with friendly message (swallow errors to avoid double-error)
  ctx.reply("Something went wrong. Please try again.").catch(() => {});
});

// Register middleware in order
bot.use(createLoggingMiddleware(logger));    // 1. Logging FIRST
bot.use(createAuthMiddleware(config.AUTHORIZED_USER_IDS)); // 2. Auth SECOND
bot.use(commandHandlers);                    // 3. Commands
bot.use(documentHandlers);                   // 4. Documents

// Graceful shutdown
process.once("SIGINT", () => {
  logger.info("Received SIGINT, stopping...");
  bot.stop();
});

process.once("SIGTERM", () => {
  logger.info("Received SIGTERM, stopping...");
  bot.stop();
});

// Start bot
bot.start({
  onStart: (botInfo) => {
    logger.info(
      { username: botInfo.username, authorizedUsers: config.AUTHORIZED_USER_IDS },
      "Bot started"
    );
  },
});
