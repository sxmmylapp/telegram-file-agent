import { Composer } from "grammy";
import type { BotContext } from "../types.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return "unknown size";

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export const documentHandlers = new Composer<BotContext>();

documentHandlers.on("message:document", async (ctx) => {
  const doc = ctx.message.document;
  const fileName = doc.file_name ?? "unnamed";
  const fileSize = doc.file_size ?? 0;
  const mimeType = doc.mime_type ?? "unknown";

  ctx.logger?.info({ fileName, fileSize, mimeType }, "Document received");

  if (fileSize === 0) {
    await ctx.reply(
      "Could not determine file size. Proceed with caution."
    );
    return;
  }

  if (fileSize > MAX_FILE_SIZE) {
    await ctx.reply(
      `The file "${fileName}" is ${formatBytes(fileSize)}, which exceeds the 20MB download limit.\n\n` +
        `Please try sending a smaller file or compressing it first.`
    );
    return;
  }

  await ctx.reply(
    `Received document:\n` +
      `- Name: ${fileName}\n` +
      `- Size: ${formatBytes(fileSize)}\n` +
      `- Type: ${mimeType}\n\n` +
      `Ready to process this file?`
  );

  ctx.logger?.debug(
    { fileName, fileSize, mimeType, fileId: doc.file_id },
    "Document metadata"
  );
});

documentHandlers.on("message:photo", async (ctx) => {
  const photos = ctx.message.photo;
  const photo = photos[photos.length - 1]; // Highest resolution
  const fileSize = photo.file_size ?? 0;
  const { width, height } = photo;

  ctx.logger?.info({ fileSize, width, height }, "Photo received");

  if (fileSize > MAX_FILE_SIZE) {
    await ctx.reply(
      `This photo is ${formatBytes(fileSize)}, which exceeds the 20MB download limit.\n\n` +
        `Try sending it as an uncompressed document instead.`
    );
    return;
  }

  await ctx.reply(
    `Received photo:\n` +
      `- Size: ${formatBytes(fileSize)}\n` +
      `- Dimensions: ${width}x${height}\n` +
      `- Type: JPEG (Telegram-compressed)\n\n` +
      `Ready to process this image?`
  );
});
