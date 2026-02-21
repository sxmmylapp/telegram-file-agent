import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Composer, InputFile, InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import { config } from "../config.js";
import { searchFiles, getMimeType } from "../services/file-search.js";
import { estimateTokens, summarizeDocument } from "../services/claude.js";
import { splitMessage } from "../services/message-splitter.js";
import { generateSummaryPdf } from "../services/pdf-generator.js";
import { extractDocxText, extractSpreadsheetText } from "../services/text-extractor.js";

// Store search results for callback queries (keyed by chat ID)
const searchCache = new Map<
  number,
  { results: Awaited<ReturnType<typeof searchFiles>>; timestamp: number }
>();

// Clean up cache entries older than 10 minutes
function cleanCache(): void {
  const now = Date.now();
  for (const [key, value] of searchCache) {
    if (now - value.timestamp > 10 * 60 * 1000) {
      searchCache.delete(key);
    }
  }
}

export const searchHandlers = new Composer<BotContext>();

searchHandlers.command("search", async (ctx) => {
  const query = ctx.match?.trim();

  if (!query) {
    await ctx.reply(
      "Usage: /search <query>\n\n" +
        "Examples:\n" +
        '  /search oak ave contract\n' +
        '  /search disclosure\n' +
        '  /search 123 main st'
    );
    return;
  }

  ctx.logger?.info({ query }, "Search command received");
  await ctx.reply(`Searching your files for "${query}"...`);
  await ctx.replyWithChatAction("typing");

  try {
    const results = await searchFiles(
      config.SEARCH_PATHS,
      query,
      ctx.logger!
    );

    if (results.length === 0) {
      await ctx.reply(
        `No matching files found for "${query}".\n\n` +
          "Tips:\n" +
          "- Try fewer or different keywords\n" +
          "- Files in iCloud must be downloaded locally (not just placeholders)"
      );
      return;
    }

    // Cache results for callback handling
    cleanCache();
    searchCache.set(ctx.chat.id, { results, timestamp: Date.now() });

    // Build inline keyboard with results
    const keyboard = new InlineKeyboard();
    const lines: string[] = [`Found ${results.length} file(s):\n`];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sizeStr = formatBytes(r.size);
      const dateStr = r.modified.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      lines.push(`${i + 1}. ${r.name} (${sizeStr}, ${dateStr})`);
      keyboard.text(`${i + 1}. ${truncate(r.name, 30)}`, `search:${i}`).row();
    }

    lines.push("\nTap a file to summarize it:");

    await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
  } catch (error) {
    ctx.logger?.error({ error, query }, "Search failed");
    await ctx.reply("Search failed. Please try again.");
  }
});

// Handle file selection from search results
searchHandlers.callbackQuery(/^search:(\d+)$/, async (ctx) => {
  const index = parseInt(ctx.match[1], 10);
  const cached = searchCache.get(ctx.chat!.id);

  if (!cached || index >= cached.results.length) {
    await ctx.answerCallbackQuery("Search results expired. Run /search again.");
    return;
  }

  const file = cached.results[index];
  ctx.logger?.info({ fileName: file.name, filePath: file.path }, "File selected for summarization");

  await ctx.answerCallbackQuery(`Processing ${file.name}...`);
  await ctx.reply(`Processing "${file.name}"...`);
  await ctx.replyWithChatAction("typing");

  try {
    const buffer = await readFile(file.path);
    const ext = extname(file.name).toLowerCase();
    const mimeType = getMimeType(ext);

    let contentBlocks: Parameters<typeof summarizeDocument>[0];

    if (ext === ".pdf") {
      const base64Data = buffer.toString("base64");
      contentBlocks = [
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
      ];
    } else if (mimeType.startsWith("image/")) {
      const base64Data = buffer.toString("base64");
      contentBlocks = [
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
    } else if (ext === ".docx") {
      const extractedText = await extractDocxText(buffer, ctx.logger!);
      contentBlocks = [
        {
          type: "text" as const,
          text: `The following is the content of a Word document titled "${file.name}":\n\n${extractedText}`,
        },
        {
          type: "text" as const,
          text: "Please provide an executive summary of this document.",
        },
      ];
    } else {
      // .xlsx or .csv
      const extractedText = await extractSpreadsheetText(buffer, file.name, ctx.logger!);
      contentBlocks = [
        {
          type: "text" as const,
          text: `The following is spreadsheet data from "${file.name}":\n\n${extractedText}`,
        },
        {
          type: "text" as const,
          text: "Please provide an executive summary of this spreadsheet data.",
        },
      ];
    }

    await estimateTokens(contentBlocks, ctx.logger!);
    const summary = await summarizeDocument(contentBlocks, ctx.logger!);
    const chunks = splitMessage(summary);

    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    // Generate and send PDF
    try {
      const pdfBuffer = await generateSummaryPdf(
        summary,
        { sourceFileName: file.name, generatedAt: new Date() },
        ctx.logger!
      );

      const pdfFileName = `summary-${file.name.replace(/\.[^.]+$/, "")}.pdf`;
      await ctx.replyWithDocument(new InputFile(pdfBuffer, pdfFileName), {
        caption: `Executive summary of "${file.name}"`,
      });
    } catch (pdfError) {
      ctx.logger?.error({ error: pdfError, fileName: file.name }, "PDF generation failed");
      await ctx.reply("(PDF generation failed — text summary above is your summary)").catch(() => {});
    }

    ctx.logger?.info({ fileName: file.name }, "Local file summarized successfully");
  } catch (error) {
    ctx.logger?.error({ error, fileName: file.name, filePath: file.path }, "Failed to process local file");
    await ctx.reply(
      `Failed to process "${file.name}". The file may not be downloaded from iCloud yet.`
    );
  }
});

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

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "\u2026";
}
