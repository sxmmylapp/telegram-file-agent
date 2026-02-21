import { Composer } from "grammy";
import type { BotContext } from "../types.js";

const VERSION = process.env.npm_package_version ?? "1.0.0";

export const commandHandlers = new Composer<BotContext>();

commandHandlers.command("start", async (ctx) => {
  ctx.logger?.info({ command: "/start" }, "Command received");

  await ctx.reply(
    "Welcome! I'm your real estate document assistant.\n\n" +
      "Use /search to find and summarize files from iCloud Drive, or send me a file directly.\n\n" +
      "Use /help to see available commands."
  );
});

commandHandlers.command("help", async (ctx) => {
  ctx.logger?.info({ command: "/help" }, "Command received");

  await ctx.reply(
    "How to use this bot:\n\n" +
      "1. /search <keywords> — finds files on your Mac (Desktop, Documents, Downloads, iCloud Drive)\n" +
      "   Example: /search oak ave contract\n\n" +
      "2. Tap any search result to get an AI summary + a PDF of the summary\n\n" +
      "3. Or send a file directly (PDF, image, Word doc, spreadsheet) and I'll summarize it on the spot\n\n" +
      "Other commands:\n" +
      "/status — check if the bot is running\n" +
      "/help — show this message"
  );
});

commandHandlers.command("status", async (ctx) => {
  ctx.logger?.info({ command: "/status" }, "Command received");

  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  await ctx.reply(
    `Bot Status:\n\n` +
      `- Version: v${VERSION}\n` +
      `- Uptime: ${uptimeStr}\n` +
      `- Status: Running`
  );
});

commandHandlers.on("message:text", async (ctx) => {
  ctx.logger?.info(
    { text: ctx.message.text.slice(0, 50) },
    "Unknown text message received"
  );

  await ctx.reply(
    "I don't understand that command. Try /help or send me a document."
  );
});
