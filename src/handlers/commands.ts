import { Composer } from "grammy";
import type { BotContext } from "../types.js";

const VERSION = process.env.npm_package_version ?? "1.0.0";

export const commandHandlers = new Composer<BotContext>();

commandHandlers.command("start", async (ctx) => {
  ctx.logger?.info({ command: "/start" }, "Command received");

  await ctx.reply(
    "Welcome! I'm your real estate document assistant.\n\n" +
      "Send me a PDF or image and I'll help you process it.\n\n" +
      "Use /help to see available commands."
  );
});

commandHandlers.command("help", async (ctx) => {
  ctx.logger?.info({ command: "/help" }, "Command received");

  await ctx.reply(
    "Available commands:\n\n" +
      "/start - Welcome message\n" +
      "/help - Show this help text\n" +
      "/status - Bot status and uptime\n\n" +
      "To process a document, simply send me a PDF, image, or photo."
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
