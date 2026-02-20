import type { BotContext } from "../types.js";

export async function downloadFileAsBuffer(ctx: BotContext): Promise<Buffer> {
  const file = await ctx.getFile();
  const fileUrl = file.getUrl();

  if (!fileUrl) {
    throw new Error("Could not get file URL from Telegram");
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
