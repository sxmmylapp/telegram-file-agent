import { Composer, InputFile } from "grammy";
import type { BotContext } from "../types.js";
import { downloadFileAsBuffer } from "../services/file-download.js";
import { estimateTokens, summarizeDocument } from "../services/claude.js";
import { splitMessage } from "../services/message-splitter.js";
import { generateSummaryPdf } from "../services/pdf-generator.js";

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

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/");

  if (!isPdf && !isImage) {
    await ctx.reply(
      "I can currently summarize PDF documents and images. Please send a supported file type."
    );
    return;
  }

  try {
    await ctx.reply(`Processing "${fileName}"...`);
    await ctx.replyWithChatAction("typing");

    const buffer = await downloadFileAsBuffer(ctx);
    const base64Data = buffer.toString("base64");

    const contentBlocks = isPdf
      ? [
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: base64Data,
            },
          },
          {
            type: "text" as const,
            text: "Please provide an executive summary of this document.",
          },
        ]
      : [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mimeType as "image/jpeg",
              data: base64Data,
            },
          },
          {
            type: "text" as const,
            text: "This is a scanned document or image. Please extract all visible text and provide an executive summary.",
          },
        ];

    await estimateTokens(contentBlocks, ctx.logger);
    const summary = await summarizeDocument(contentBlocks, ctx.logger);
    const chunks = splitMessage(summary);

    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    // Generate and send PDF attachment
    let pdfSent = false;
    try {
      const pdfBuffer = await generateSummaryPdf(summary, {
        sourceFileName: fileName,
        generatedAt: new Date(),
      }, ctx.logger);

      const pdfFileName = `summary-${fileName.replace(/\.[^.]+$/, "")}.pdf`;
      await ctx.replyWithDocument(
        new InputFile(pdfBuffer, pdfFileName),
        { caption: `Executive summary of "${fileName}"` }
      );
      pdfSent = true;
      ctx.logger?.info({ fileName, pdfSize: pdfBuffer.length }, "PDF sent successfully");
    } catch (pdfError) {
      ctx.logger?.error({ error: pdfError, fileName }, "PDF generation failed, text summary already sent");
      await ctx.reply("(PDF generation failed — text summary above is your summary)").catch(() => {});
    }

    ctx.logger?.info({ fileName, chunks: chunks.length, pdfSent }, "Document summarized successfully");
  } catch (error) {
    ctx.logger?.error({ error, fileName }, "Failed to process document");
    await ctx
      .reply("Sorry, I couldn't process that document. Please try again.")
      .catch(() => {});
  }
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

  try {
    await ctx.reply("Processing your image...");
    await ctx.replyWithChatAction("typing");

    const buffer = await downloadFileAsBuffer(ctx);
    const base64Data = buffer.toString("base64");

    const contentBlocks = [
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: base64Data,
        },
      },
      {
        type: "text" as const,
        text: "This is a scanned document or image. Please extract all visible text and provide an executive summary.",
      },
    ];

    await estimateTokens(contentBlocks, ctx.logger);
    const summary = await summarizeDocument(contentBlocks, ctx.logger);
    const chunks = splitMessage(summary);

    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    // Generate and send PDF attachment
    let pdfSent = false;
    try {
      const pdfFileName = `summary-photo-${Date.now()}.pdf`;
      const sourceLabel = `Photo (${width}x${height})`;

      const pdfBuffer = await generateSummaryPdf(summary, {
        sourceFileName: sourceLabel,
        generatedAt: new Date(),
      }, ctx.logger);

      await ctx.replyWithDocument(
        new InputFile(pdfBuffer, pdfFileName),
        { caption: `Executive summary of photo (${width}x${height})` }
      );
      pdfSent = true;
      ctx.logger?.info({ width, height, pdfSize: pdfBuffer.length }, "PDF sent successfully");
    } catch (pdfError) {
      ctx.logger?.error({ error: pdfError, width, height }, "PDF generation failed, text summary already sent");
      await ctx.reply("(PDF generation failed — text summary above is your summary)").catch(() => {});
    }

    ctx.logger?.info({ width, height, chunks: chunks.length, pdfSent }, "Photo summarized successfully");
  } catch (error) {
    ctx.logger?.error({ error, width, height }, "Failed to process image");
    await ctx
      .reply("Sorry, I couldn't process that image. Please try again.")
      .catch(() => {});
  }
});
