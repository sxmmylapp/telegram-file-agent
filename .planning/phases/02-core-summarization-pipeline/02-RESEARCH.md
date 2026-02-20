# Phase 2: Core Summarization Pipeline - Research

**Researched:** 2026-02-19
**Domain:** Claude API integration (PDF processing, Vision, token counting) with Telegram bot file handling
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing Telegram bot from a file-receipt acknowledger into a document summarizer. The bot already receives documents and photos, validates file sizes, and logs metadata (Phase 1 complete). Now it needs to: (1) download files from Telegram, (2) send them to Claude's API as base64-encoded content, and (3) return executive summaries to the user.

The core technical challenge is straightforward. Claude's API natively handles PDFs via `document` content blocks and images via `image` content blocks -- no OCR or PDF parsing libraries needed. The `@anthropic-ai/sdk` (v0.77.0) provides a typed TypeScript client. The grammY `@grammyjs/files` plugin (already installed) provides `getFile()` and download URL construction. The Anthropic token counting API (`messages.countTokens()`) is free and enables pre-call cost logging as required by SUMM-04.

The primary risks are: (1) Telegram's 20MB download limit vs Claude's 32MB/100-page limit -- Telegram is the bottleneck, (2) Telegram's 4096-character message limit requiring summary splitting for long documents, and (3) cost management -- a 100-page PDF can use 150K-300K input tokens costing $0.45-$0.90 with Claude Sonnet 4.6 at $3/MTok input.

**Primary recommendation:** Use `@anthropic-ai/sdk` with Claude Sonnet 4.6 (`claude-sonnet-4-6`), base64 encoding for both PDFs and images, `countTokens()` for pre-call cost estimation, and a message-splitting utility for long summaries exceeding Telegram's 4096-char limit.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROC-01 | Bot parses PDF documents via Claude's native PDF support (up to 32MB, 100 pages) | Claude API `document` content block with `type: "base64"` and `media_type: "application/pdf"` handles PDFs natively. SDK: `@anthropic-ai/sdk` `messages.create()`. Telegram 20MB limit is the actual constraint. |
| PROC-02 | Bot reads scanned documents and images via Claude Vision (no separate OCR needed) | Claude API `image` content block with `type: "base64"` supports JPEG, PNG, GIF, WebP. Images up to 5MB via API. Token cost: `(width * height) / 750` tokens per image. |
| SUMM-01 | Bot summarizes document content using Claude API | `@anthropic-ai/sdk` `messages.create()` with system prompt for executive summary format. Use Claude Sonnet 4.6 for best cost/quality ratio at $3/$15 per MTok. |
| SUMM-02 | Summary follows executive summary format (1-2 pages: key details, highlights, concerns) | Achieved via system prompt engineering. Structure: key details, highlights, concerns sections. `max_tokens: 4096` gives ~3000 words which is 1-2 pages. |
| SUMM-04 | Bot estimates token count and logs cost before each API call | Free `messages.countTokens()` API endpoint returns `{ input_tokens: N }`. Multiply by model pricing ($3/MTok input) and log before calling `messages.create()`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.77.0 | Claude API client (messages, token counting) | Official Anthropic TypeScript SDK; full type safety, streaming support, token counting |
| `grammy` | ^1.40.0 (existing) | Telegram bot framework | Already installed in Phase 1 |
| `@grammyjs/files` | ^1.2.0 (existing) | File download from Telegram | Already installed; provides `getFile()` and download URL construction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pino` | ^10.3.1 (existing) | Structured logging for token counts and costs | Already installed; use for SUMM-04 cost logging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude Sonnet 4.6 ($3/$15 MTok) | Claude Haiku 4.5 ($1/$5 MTok) | 3x cheaper but lower quality summaries; Sonnet is better for nuanced document analysis. Could add as config option later. |
| Claude Sonnet 4.6 | Claude Opus 4.6 ($5/$25 MTok) | Higher quality but 67% more expensive input, 67% more expensive output. Overkill for summarization. |
| Base64 PDF encoding | Files API (upload then reference) | Files API is beta (`files-api-2025-04-14`), adds complexity (two API calls). Base64 is simpler and stable. |
| `countTokens()` API | Manual estimation (chars / 4) | API is free and accurate; manual estimation is unreliable for PDFs (text + images per page). Always use the API. |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot.ts                  # (existing) Bot setup and middleware
├── config.ts               # (existing) Env vars -- add ANTHROPIC_API_KEY
├── logger.ts               # (existing) Pino logger
├── types.ts                # (existing) BotContext type
├── handlers/
│   ├── commands.ts          # (existing) /start, /help, /status
│   └── documents.ts         # (modify) Wire up summarization pipeline
├── middleware/
│   ├── auth.ts              # (existing)
│   └── logging.ts           # (existing)
└── services/
    ├── claude.ts            # NEW: Claude API client wrapper (summarize, countTokens)
    ├── file-download.ts     # NEW: Telegram file download -> Buffer
    └── message-splitter.ts  # NEW: Split long text into 4096-char Telegram messages
```

### Pattern 1: Service Layer Separation
**What:** Isolate Claude API calls into a dedicated service module rather than putting API logic in handlers.
**When to use:** Always -- keeps handlers thin, makes testing/mocking possible, centralizes API configuration.
**Example:**
```typescript
// Source: Anthropic official docs + SDK README
// src/services/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import type { Logger } from "pino";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SUMMARIZE_MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a real estate document analyst. Produce an executive summary with these sections:

## Key Details
- Document type, parties involved, dates, amounts
- Critical terms and conditions

## Highlights
- Notable or favorable terms
- Important deadlines or milestones

## Concerns
- Potential risks or red flags
- Missing information or ambiguities
- Items requiring follow-up

Keep the summary concise but thorough (1-2 pages equivalent).`;

interface TokenEstimate {
  inputTokens: number;
  estimatedCostUsd: number;
}

export async function estimateTokens(
  contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"],
  logger: Logger
): Promise<TokenEstimate> {
  const response = await client.messages.countTokens({
    model: SUMMARIZE_MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const inputTokens = response.input_tokens;
  const estimatedCostUsd = (inputTokens / 1_000_000) * 3 + (MAX_OUTPUT_TOKENS / 1_000_000) * 15;

  logger.info(
    { inputTokens, estimatedCostUsd: estimatedCostUsd.toFixed(4), model: SUMMARIZE_MODEL },
    "Token estimate before API call"
  );

  return { inputTokens, estimatedCostUsd };
}

export async function summarizeDocument(
  contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"],
  logger: Logger
): Promise<string> {
  const message = await client.messages.create({
    model: SUMMARIZE_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  logger.info(
    {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model: SUMMARIZE_MODEL,
    },
    "Claude API call completed"
  );

  return textBlock.text;
}
```

### Pattern 2: File Download to Buffer Pipeline
**What:** Download Telegram file to a Buffer, then base64-encode for Claude API.
**When to use:** For all document/photo processing.
**Example:**
```typescript
// src/services/file-download.ts
import type { BotContext } from "../types.js";

export async function downloadFileAsBuffer(ctx: BotContext): Promise<Buffer> {
  const file = await ctx.getFile();
  const fileUrl = file.getUrl();

  if (!fileUrl) {
    throw new Error("Could not get file URL from Telegram");
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

### Pattern 3: Content Block Construction
**What:** Build the correct content block array based on file type (PDF vs image).
**When to use:** When preparing the Claude API request.
**Example:**
```typescript
// For PDFs (PROC-01)
const pdfContentBlocks = [
  {
    type: "document" as const,
    source: {
      type: "base64" as const,
      media_type: "application/pdf" as const,
      data: buffer.toString("base64"),
    },
  },
  {
    type: "text" as const,
    text: "Please provide an executive summary of this document.",
  },
];

// For images (PROC-02)
const imageContentBlocks = [
  {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const, // or image/png, image/webp, image/gif
      data: buffer.toString("base64"),
    },
  },
  {
    type: "text" as const,
    text: "This is a scanned document or image. Please extract all text and provide an executive summary.",
  },
];
```

### Pattern 4: Telegram Message Splitting
**What:** Split long Claude responses into multiple Telegram messages (4096 char limit).
**When to use:** When summaries exceed 4096 characters.
**Example:**
```typescript
// src/services/message-splitter.ts
const TELEGRAM_MAX_LENGTH = 4096;

export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIndex = remaining.lastIndexOf("\n\n", TELEGRAM_MAX_LENGTH);
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_LENGTH / 2) {
      // Fall back to newline
      splitIndex = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    }
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_LENGTH / 2) {
      // Fall back to hard cut
      splitIndex = TELEGRAM_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
```

### Anti-Patterns to Avoid
- **Putting Claude API calls directly in handlers:** Makes the handler bloated and untestable. Always use a service layer.
- **Not awaiting each Telegram message send:** Sending multiple split messages without awaiting can cause them to arrive out of order.
- **Loading entire file into memory for huge PDFs:** With 20MB Telegram limit this is fine (20MB Buffer is acceptable), but don't hold multiple file buffers simultaneously.
- **Hardcoding model name in multiple places:** Use a single config constant for the model ID so it can be changed easily.
- **Ignoring the response `usage` field:** Always log actual token usage from the response, not just the estimate. Compare estimate vs actual for monitoring.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser (pdf-parse, pdfjs-dist) | Claude's native `document` content block | Claude extracts text AND understands visual layout, charts, tables. A parser only gets raw text. |
| OCR for scanned documents | Tesseract.js, Google Vision API | Claude's native `image` content block | Claude Vision handles OCR + understanding in one call. Separate OCR adds latency, complexity, and cost. |
| Token counting | Character-based estimation (chars/4) | `client.messages.countTokens()` API | Free, accurate for all content types including PDFs and images. Manual estimation is unreliable. |
| API retry logic | Custom retry with exponential backoff | `@grammyjs/auto-retry` (Telegram) + SDK built-in retries (Claude) | The Anthropic SDK has built-in retry logic. Don't duplicate it. |

**Key insight:** Claude's API is the entire document processing pipeline. PDF parsing, OCR, text extraction, and summarization are all handled in a single API call. Adding separate libraries for any of these steps adds complexity without benefit.

## Common Pitfalls

### Pitfall 1: Telegram 4096 Character Message Limit
**What goes wrong:** Claude generates a summary longer than 4096 characters, `ctx.reply()` throws a Telegram API error.
**Why it happens:** Executive summaries for complex documents can easily exceed 4096 chars. Claude's `max_tokens: 4096` produces ~3000 words (far exceeding 4096 chars).
**How to avoid:** Always split messages before sending. Use the message-splitter utility. Send chunks sequentially with `await` between each.
**Warning signs:** GrammyError with "message is too long" or HTTP 400 from Telegram API.

### Pitfall 2: Base64 Encoding Inflates Memory Usage by 33%
**What goes wrong:** A 20MB file becomes ~27MB when base64 encoded, which is fine but should be accounted for.
**Why it happens:** Base64 encoding increases data size by approximately 33%.
**How to avoid:** This is manageable for the 20MB Telegram limit (27MB encoded is under Claude's 32MB request limit). Just be aware of it. Don't hold multiple encoded buffers simultaneously.
**Warning signs:** Memory spikes during processing. Monitor with Node.js `process.memoryUsage()`.

### Pitfall 3: Not Handling "Processing" State for Long Operations
**What goes wrong:** User sends a large PDF, bot goes silent for 30-60 seconds while Claude processes, user thinks bot is broken.
**Why it happens:** Large documents take significant time for Claude to analyze. No feedback = bad UX.
**How to avoid:** Send a "Processing your document..." message immediately, then send the summary when ready. Use `ctx.replyWithChatAction("typing")` to show typing indicator.
**Warning signs:** User sends duplicate files because they think the first one failed.

### Pitfall 4: Forgetting to Add ANTHROPIC_API_KEY to Config
**What goes wrong:** Bot starts but crashes on first document because the API key is missing.
**Why it happens:** New env var not added to config.ts validation.
**How to avoid:** Add `ANTHROPIC_API_KEY` to `config.ts` using the existing `requireEnv()` pattern. Update `.env.example` if one exists.
**Warning signs:** "Missing required environment variable: ANTHROPIC_API_KEY" at startup.

### Pitfall 5: Photos vs Documents MIME Type Handling
**What goes wrong:** Telegram sends photos as compressed JPEG with no MIME type in the `photo` object. Documents have `mime_type` but photos don't.
**Why it happens:** Telegram's `message:photo` handler gives `PhotoSize[]` (no MIME type), while `message:document` gives `Document` (with `mime_type`).
**How to avoid:** For photos, always use `image/jpeg` as the media type. For documents, check `mime_type` to determine if it's a PDF (`application/pdf`) or an image (`image/*`).
**Warning signs:** Wrong `media_type` in Claude API request causing errors.

### Pitfall 6: Cost Surprises with Large Documents
**What goes wrong:** A 100-page PDF costs $0.45-$0.90 per summarization (150K-300K input tokens at $3/MTok + output tokens at $15/MTok).
**Why it happens:** Each PDF page uses 1,500-3,000 text tokens PLUS image tokens (each page rendered as image ~1,600 tokens). So a page costs ~3,000-4,600 tokens.
**How to avoid:** Log token count and cost estimate BEFORE the API call (SUMM-04). Consider adding a cost threshold warning (e.g., warn user if estimated cost exceeds $0.50). Consider adding configurable max pages.
**Warning signs:** Unexpectedly high API bills. Monitor via logged cost estimates.

## Code Examples

Verified patterns from official sources:

### Complete Document Handler Flow
```typescript
// Source: Anthropic docs + grammY docs (combined pattern)
// src/handlers/documents.ts (modified)

documentHandlers.on("message:document", async (ctx) => {
  const doc = ctx.message.document;
  const fileName = doc.file_name ?? "unnamed";
  const fileSize = doc.file_size ?? 0;
  const mimeType = doc.mime_type ?? "unknown";

  ctx.logger?.info({ fileName, fileSize, mimeType }, "Document received");

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    await ctx.reply(`File too large (${formatBytes(fileSize)}). Max: 20MB.`);
    return;
  }

  // Only process supported types
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/");

  if (!isPdf && !isImage) {
    await ctx.reply("I can only process PDF documents and images. Please send a supported file.");
    return;
  }

  // Show processing indicator
  await ctx.reply(`Processing "${fileName}"...`);
  await ctx.replyWithChatAction("typing");

  // Download file
  const buffer = await downloadFileAsBuffer(ctx);
  const base64Data = buffer.toString("base64");

  // Build content blocks
  const contentBlocks = isPdf
    ? [
        { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Data } },
        { type: "text" as const, text: "Provide an executive summary of this document." },
      ]
    : [
        { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg", data: base64Data } },
        { type: "text" as const, text: "Extract text from this scanned document and provide an executive summary." },
      ];

  // Estimate tokens and log cost (SUMM-04)
  await estimateTokens(contentBlocks, ctx.logger);

  // Summarize
  const summary = await summarizeDocument(contentBlocks, ctx.logger);

  // Send (split if needed)
  const chunks = splitMessage(summary);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
});
```

### Token Counting API (TypeScript)
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/token-counting
const response = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  system: "You are a document analyst.",
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64
        }
      },
      { type: "text", text: "Summarize this document." }
    ]
  }]
});
// Returns: { input_tokens: N }
```

### PDF via Claude API (TypeScript)
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/pdf-support
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64  // Buffer.from(fileData).toString("base64")
        }
      },
      { type: "text", text: "What are the key findings?" }
    ]
  }]
});
```

### Image via Claude Vision (TypeScript)
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: imageBase64
        }
      },
      { type: "text", text: "Extract and summarize the text in this image." }
    ]
  }]
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate PDF parser + OCR + LLM | Claude API handles PDF natively (document content block) | 2024 (Claude 3.5) | Eliminates pdf-parse, Tesseract.js, and multi-step pipelines |
| Manual token estimation (chars/4) | Free `countTokens()` API endpoint | 2024 | Accurate pre-call cost estimation for all content types including PDFs/images |
| Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`) | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Feb 2026 | Better quality, same price ($3/$15 MTok), 64K max output |
| Separate OCR service for scanned docs | Claude Vision handles images natively | 2024 (Claude 3) | One API call for OCR + understanding + summarization |

**Deprecated/outdated:**
- `claude-3-5-sonnet-*` model IDs: Still work but Claude Sonnet 4.6 is current. Use `claude-sonnet-4-6` alias.
- `claude-3-haiku-*`: Deprecated, retiring April 2026. Use `claude-haiku-4-5` if you need a cheap model.
- Files API (`files-api-2025-04-14`): Still in beta. Base64 encoding is the stable, recommended approach for one-off document processing.

## Open Questions

1. **Cost threshold for user warning**
   - What we know: A 100-page PDF can cost $0.45-$0.90 per summarization
   - What's unclear: Should the bot warn users before processing expensive documents?
   - Recommendation: Implement cost logging (SUMM-04 requirement). Defer user-facing cost warnings to a later phase. Log the estimate and let Sammy review usage patterns.

2. **Model configurability**
   - What we know: Claude Sonnet 4.6 is the best cost/quality model for summarization. Haiku 4.5 is 3x cheaper.
   - What's unclear: Should the model be configurable via env var?
   - Recommendation: Use `CLAUDE_MODEL` env var defaulting to `claude-sonnet-4-6`. This lets Sammy switch to Haiku for cost savings or Opus for quality without code changes.

3. **Streaming vs non-streaming responses**
   - What we know: SDK supports streaming via `messages.stream()`. Long documents take 15-60 seconds.
   - What's unclear: Should we stream the response to improve perceived latency?
   - Recommendation: Start with non-streaming (simpler). Telegram doesn't support streaming edits well. The "Processing..." message + typing indicator is sufficient UX for Phase 2.

## Sources

### Primary (HIGH confidence)
- [Anthropic PDF Support docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) - PDF content block format, limits (32MB, 100 pages), token costs, TypeScript examples
- [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) - Image format (JPEG/PNG/GIF/WebP), 5MB API limit, token formula `(w*h)/750`, TypeScript examples
- [Anthropic Token Counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) - `countTokens()` API, free, supports PDFs and images, TypeScript examples
- [Anthropic Pricing docs](https://platform.claude.com/docs/en/about-claude/pricing) - Sonnet 4.6: $3/$15 MTok, Haiku 4.5: $1/$5 MTok, Opus 4.6: $5/$25 MTok
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) - Model IDs: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6`
- [@anthropic-ai/sdk GitHub](https://github.com/anthropics/anthropic-sdk-typescript) - SDK v0.77.0, ESM/CJS support, full TypeScript types
- [grammY Files Plugin docs](https://grammy.dev/plugins/files) - `getFile()`, `file.getUrl()`, `file.download()` methods
- [grammY File Handling guide](https://grammy.dev/guide/files) - 20MB download limit, file_path URL construction, Buffer support

### Secondary (MEDIUM confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - Version 0.77.0 confirmed as latest
- [Telegram Bot API docs](https://core.telegram.org/bots/api#sendmessage) - 4096 character message limit (well-documented, verified by multiple sources)

### Tertiary (LOW confidence)
- None. All critical claims verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Anthropic SDK and docs verified, versions confirmed on npm
- Architecture: HIGH - Patterns taken directly from official TypeScript examples in Anthropic docs
- Pitfalls: HIGH - Telegram message limit is well-documented; memory/cost concerns derived from official token cost documentation

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable APIs, unlikely to change within 30 days)
