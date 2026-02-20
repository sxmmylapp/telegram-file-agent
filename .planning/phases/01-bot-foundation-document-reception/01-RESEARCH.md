# Phase 1: Bot Foundation & Document Reception - Research

**Researched:** 2026-02-19
**Domain:** Telegram Bot API, grammY framework, TypeScript bot architecture, structured logging
**Confidence:** HIGH

## Summary

This phase builds a Telegram bot using the grammY framework (TypeScript-first, v1.40.0) that receives documents from a single authorized user, validates file sizes, and confirms receipt. The core technical challenges are straightforward: grammY provides built-in filter queries for documents and photos, a files plugin for downloading, and a clean middleware system for authorization. The bot runs as a long-polling process on Railway (persistent Node.js service).

The key architectural decisions are: (1) use long polling (not webhooks) since Railway runs persistent processes and long polling is simpler with no public URL/SSL requirements, (2) use Pino for structured JSON logging (5-10x faster than Winston, native JSON output), and (3) use a simple middleware guard for single-user authorization. Telegram sends images two ways -- as "photos" (compressed, array of PhotoSize) and as "documents" (uncompressed, original file) -- so the bot must handle both `message:document` and `message:photo` filter queries.

**Primary recommendation:** Use grammY v1.40.0 with long polling, @grammyjs/files for downloads, Pino for logging, and a custom auth middleware checking `ctx.from.id` against an environment variable. Build with esbuild, run with Node.js on Railway.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOT-01 | User can interact with bot via conversational Telegram commands | grammY `bot.command()` for /start, /help, /status; `bot.on("message:text")` for conversational fallback; `ctx.reply()` for responses |
| BOT-02 | Bot restricts access to authorized Telegram user ID only | Custom middleware checking `ctx.from?.id === AUTHORIZED_USER_ID`; applied globally via `bot.use()` before all other handlers |
| BOT-03 | Bot logs all operations with structured logging | Pino v10.3.1 with child loggers carrying requestId, function name, userId; JSON output in production, pino-pretty in dev |
| BOT-04 | Bot handles errors gracefully with user-friendly messages and full stack traces in logs | grammY `bot.catch()` handler with GrammyError/HttpError discrimination; Pino `err` serializer for full stack traces; `ctx.reply("Something went wrong")` for user-facing errors |
| INP-01 | User can send documents directly to bot via Telegram chat | `bot.on("message:document")` for files, `bot.on("message:photo")` for images; access via `ctx.msg.document` and `ctx.msg.photo` |
| INP-02 | Bot validates file size against Telegram 20MB download limit and warns on oversized files | Check `document.file_size` or last `PhotoSize.file_size` against 20MB (20 * 1024 * 1024); warn before calling `getFile()` since Telegram's `getFile` API hard-fails above 20MB |
| INP-03 | Bot shows received document details and confirms before processing | Extract `file_name`, `file_size`, `mime_type` from Document object; format human-readable size; reply with details and ask user to confirm |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.40.0 | Telegram Bot framework | TypeScript-first, modern middleware API, active development, official plugins ecosystem |
| @grammyjs/files | 1.2.0 | File download helper | Official plugin; adds `download()` and `getUrl()` to file objects |
| pino | 10.3.1 | Structured JSON logging | 5-10x faster than Winston; native JSON; child loggers for request context |
| pino-pretty | latest | Dev-only log formatting | Human-readable colored output in development |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/auto-retry | latest | Auto-retry failed API calls | Always -- handles Telegram rate limits and transient errors |
| dotenv | latest | Load .env file locally | Development only; Railway injects env vars at runtime |
| tsx | 4.21.0 | TypeScript execution | Development: `tsx watch src/bot.ts` for hot reload |
| esbuild | latest | TypeScript bundler | Production build: bundle to single JS file for Railway |
| typescript | 5.x | Type checking | Dev dependency for type safety |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Long polling | Webhooks | Webhooks are more efficient but require public URL, SSL, timeout management, and queue system for long operations -- unnecessary complexity for a single-user bot on Railway |
| Pino | Winston | Winston has more transports but is 5-10x slower; Pino's JSON-first output is better for Railway's log viewer |
| Custom auth middleware | grammy-guard | grammy-guard adds dependency for one simple check; custom middleware is 5 lines and more transparent |
| esbuild | tsc | tsc is slower; esbuild produces optimized bundles; both work but esbuild is the modern standard |

**Installation:**
```bash
npm install grammy @grammyjs/files @grammyjs/auto-retry pino dotenv
npm install -D typescript tsx esbuild pino-pretty @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot.ts               # Bot initialization, middleware registration, start
├── config.ts            # Environment variable loading and validation
├── logger.ts            # Pino logger factory with child logger helper
├── middleware/
│   ├── auth.ts          # Single-user authorization middleware
│   └── logging.ts       # Request-scoped logging middleware (attaches child logger to ctx)
├── handlers/
│   ├── commands.ts      # /start, /help, /status command handlers
│   └── documents.ts     # Document/photo reception and validation handlers
└── types.ts             # Custom context type (with logger, config)
```

### Pattern 1: Custom Context with Logger
**What:** Extend grammY's context to carry a request-scoped Pino child logger
**When to use:** Every handler needs structured logging with consistent requestId

```typescript
// Source: grammY docs (context flavors) + Pino child loggers
import { Context } from "grammy";
import { FileFlavor } from "@grammyjs/files";
import type { Logger } from "pino";

interface BotContextFlavor {
  logger: Logger;
  requestId: string;
}

type BotContext = FileFlavor<Context> & BotContextFlavor;
```

### Pattern 2: Middleware-first Authorization
**What:** Global middleware that rejects unauthorized users before any handler runs
**When to use:** Applied as the first middleware in the chain

```typescript
// Source: grammY middleware docs
import { Middleware } from "grammy";
import type { BotContext } from "../types";

export function authMiddleware(authorizedUserId: number): Middleware<BotContext> {
  return async (ctx, next) => {
    if (ctx.from?.id !== authorizedUserId) {
      ctx.logger.warn({ userId: ctx.from?.id }, "Unauthorized access attempt");
      await ctx.reply("Sorry, this bot is private.");
      return; // Do NOT call next()
    }
    await next();
  };
}
```

### Pattern 3: Composer-based Module Organization
**What:** Each feature area exports a Composer that the main bot imports
**When to use:** When splitting handlers into separate files

```typescript
// Source: grammY structuring docs
// src/handlers/documents.ts
import { Composer } from "grammy";
import type { BotContext } from "../types";

export const documentHandlers = new Composer<BotContext>();

documentHandlers.on("message:document", async (ctx) => {
  const doc = ctx.msg.document;
  // ... handle document
});
```

### Anti-Patterns to Avoid
- **Putting all handlers in one file:** grammY's Composer pattern exists specifically for modular code organization. Use it from the start to avoid a monolithic bot.ts.
- **Checking file_size after calling getFile():** Telegram's `getFile()` will fail for files over 20MB. Check `document.file_size` BEFORE attempting download.
- **Using webhooks on Railway for a single-user bot:** Long polling is simpler, requires no public URL, and Railway keeps the process alive. Webhooks add unnecessary timeout and concurrency complexity.
- **String-interpolated log messages:** Use Pino's structured object logging (`logger.info({ fileSize, fileName }, "File received")`) instead of template literals. This enables machine-parseable logs.
- **Swallowing errors in handlers:** Always let errors propagate to `bot.catch()` or explicitly log with full `err` object. Never use empty catch blocks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File downloads from Telegram | Custom HTTP fetch with token auth | @grammyjs/files plugin | Handles URL construction, auth, download, and local file caching |
| Telegram API rate limit handling | Custom retry logic with backoff | @grammyjs/auto-retry | Handles flood wait errors, 429 responses, exponential backoff |
| JSON structured logging | Custom console.log wrapper | Pino | Serializers, child loggers, levels, async I/O, pino-pretty for dev |
| TypeScript type-safe context | Manual type assertions | grammY's context flavors (FileFlavor) | Type narrowing on filter queries is automatic and bulletproof |

**Key insight:** grammY's plugin ecosystem covers the common infrastructure needs (files, retry, sessions, rate limiting). The only custom code needed is the auth middleware and document handling logic.

## Common Pitfalls

### Pitfall 1: Photos vs Documents Confusion
**What goes wrong:** Bot only handles `message:document` and misses images sent as photos (which Telegram compresses and delivers as PhotoSize arrays, not Document objects).
**Why it happens:** Telegram treats photos and documents as different message types. Users can send images either way.
**How to avoid:** Register handlers for BOTH `message:document` and `message:photo`. For photos, the file info is in `ctx.msg.photo` (an array of PhotoSize) -- use the LAST element for highest resolution. Photos don't have `file_name` or `mime_type`; you must infer these.
**Warning signs:** "I sent a photo but the bot didn't respond" -- missing photo handler.

### Pitfall 2: file_size is Optional in Telegram API
**What goes wrong:** Bot crashes with "Cannot read property of undefined" when checking file size.
**Why it happens:** The `file_size` field is marked as optional in the Telegram Bot API. While it's almost always present, the TypeScript types correctly mark it as `number | undefined`.
**How to avoid:** Always use optional chaining or default values: `const size = doc.file_size ?? 0`. If size is unknown (0), warn the user that size couldn't be verified rather than silently proceeding.
**Warning signs:** TypeScript compilation errors about `undefined` on file_size.

### Pitfall 3: Not Handling Graceful Shutdown
**What goes wrong:** Railway deploys a new version, sends SIGTERM, but the bot doesn't stop cleanly. Pending updates get lost or duplicated.
**Why it happens:** Long polling keeps a connection open to Telegram. Without explicit shutdown, the process hangs or gets killed mid-request.
**How to avoid:** Register `process.once("SIGINT", () => bot.stop())` and `process.once("SIGTERM", () => bot.stop())` before calling `bot.start()`.
**Warning signs:** Duplicate message processing after deployments; Railway showing "timeout waiting for process to stop".

### Pitfall 4: Forgetting to await Promises in Handlers
**What goes wrong:** Error handler never fires for async errors; bot appears to work but silently drops errors.
**Why it happens:** grammY can only catch errors from middleware if the middleware returns a rejected promise. Non-awaited promises escape the error boundary.
**How to avoid:** Use `await` on every async call. Enable ESLint rule `@typescript-eslint/no-floating-promises`.
**Warning signs:** Errors in Railway logs that don't appear in `bot.catch()`; "unhandledRejection" process warnings.

### Pitfall 5: Railway Health Check Timeout with Long Polling
**What goes wrong:** Railway marks the deployment as failed because it expects an HTTP health check response.
**Why it happens:** Long polling bots don't listen on an HTTP port. Railway's default health check expects an HTTP 200.
**How to avoid:** Either (a) disable Railway's health check for this service, or (b) add a minimal HTTP server on a port for health checking (e.g., a simple Express endpoint returning 200). Railway's Railpack auto-detects no web server and should handle this, but verify.
**Warning signs:** Deployment marked as "crashed" despite the bot running fine in logs.

## Code Examples

Verified patterns from official sources:

### Complete Bot Initialization
```typescript
// Source: grammY getting-started + deployment docs
import { Bot } from "grammy";
import { hydrateFiles, FileFlavor } from "@grammyjs/files";
import { autoRetry } from "@grammyjs/auto-retry";
import { config } from "./config";
import { createLogger } from "./logger";
import type { BotContext } from "./types";

const logger = createLogger();

const bot = new Bot<BotContext>(config.BOT_TOKEN);

// Install API-level plugins
bot.api.config.use(hydrateFiles(bot.token));
bot.api.config.use(autoRetry());

// Global error handler
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error({ err: err.error, updateId: ctx.update.update_id }, "Unhandled bot error");
  ctx.reply("Something went wrong. Please try again.").catch(() => {});
});

// ... register middleware and handlers ...

// Graceful shutdown
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

// Start long polling
bot.start({
  onStart: (botInfo) => {
    logger.info({ username: botInfo.username }, "Bot started");
  },
});
```

### Authorization Middleware
```typescript
// Source: grammY middleware pattern + custom
import { Middleware } from "grammy";
import type { BotContext } from "../types";

export function createAuthMiddleware(authorizedUserId: number): Middleware<BotContext> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || userId !== authorizedUserId) {
      ctx.logger.warn(
        { attemptedUserId: userId, chat: ctx.chat?.id },
        "Unauthorized access attempt"
      );
      await ctx.reply("This bot is private. Access denied.");
      return;
    }
    await next();
  };
}
```

### Document Reception Handler
```typescript
// Source: grammY filter queries + Telegram Bot API Document type
import { Composer } from "grammy";
import type { BotContext } from "../types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB Telegram download limit

export const documentHandlers = new Composer<BotContext>();

documentHandlers.on("message:document", async (ctx) => {
  const doc = ctx.msg.document;
  const fileSize = doc.file_size ?? 0;
  const fileName = doc.file_name ?? "unnamed";
  const mimeType = doc.mime_type ?? "unknown";

  ctx.logger.info({ fileName, fileSize, mimeType }, "Document received");

  if (fileSize > MAX_FILE_SIZE) {
    await ctx.reply(
      `The file "${fileName}" is ${formatBytes(fileSize)}, which exceeds Telegram's 20MB download limit. Please send a smaller file.`
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
});

documentHandlers.on("message:photo", async (ctx) => {
  const photos = ctx.msg.photo;
  const largest = photos[photos.length - 1]; // Highest resolution
  const fileSize = largest.file_size ?? 0;

  ctx.logger.info(
    { fileSize, width: largest.width, height: largest.height },
    "Photo received"
  );

  if (fileSize > MAX_FILE_SIZE) {
    await ctx.reply(
      `This photo is ${formatBytes(fileSize)}, which exceeds Telegram's 20MB download limit. Try sending it as an uncompressed file instead.`
    );
    return;
  }

  await ctx.reply(
    `Received photo:\n` +
    `- Size: ${formatBytes(fileSize)}\n` +
    `- Dimensions: ${largest.width}x${largest.height}\n` +
    `- Type: JPEG (Telegram-compressed)\n\n` +
    `Ready to process this image?`
  );
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "unknown size";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
```

### Pino Logger Setup
```typescript
// Source: Pino docs
import pino from "pino";

export function createLogger() {
  const isDev = process.env.NODE_ENV !== "production";

  return pino({
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    transport: isDev
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "yyyy-mm-dd HH:MM:ss" } }
      : undefined,
    base: { service: "telegram-file-agent" },
  });
}

// Usage in logging middleware: create child logger per update
export function createRequestLogger(parentLogger: pino.Logger, updateId: number, userId?: number) {
  return parentLogger.child({
    requestId: `upd-${updateId}`,
    userId,
  });
}
```

### Config Validation
```typescript
// Source: Standard pattern
import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  BOT_TOKEN: requireEnv("BOT_TOKEN"),
  AUTHORIZED_USER_ID: Number(requireEnv("AUTHORIZED_USER_ID")),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf (Node.js) | grammY | 2021+ | grammY is TypeScript-first with better type safety, middleware design, and plugin ecosystem |
| ts-node for dev runtime | tsx | 2023+ | tsx is faster (esbuild-powered), zero-config, and handles ESM natively |
| Winston for logging | Pino | 2020+ | Pino is 5-10x faster with native JSON output; Winston still common but slower |
| Manual retry logic | @grammyjs/auto-retry | 2022+ | Official plugin handles flood wait and 429 errors automatically |
| node-telegram-bot-api | grammy | 2021+ | grammY has better TypeScript types, middleware system, and active maintenance |

**Deprecated/outdated:**
- **Telegraf:** Still maintained but grammY is the recommended modern alternative for TypeScript bots
- **ts-node:** Slower than tsx for development; tsx has effectively replaced it for most TypeScript projects
- **console.log for logging:** Never appropriate for production; structured logging (Pino) is the standard

## Open Questions

1. **Railway Health Checks with Long Polling**
   - What we know: Railway auto-detects web servers and expects HTTP health checks. Long polling bots don't serve HTTP.
   - What's unclear: Whether Railway's Railpack builder gracefully handles a non-HTTP service, or if we need to add a minimal health check endpoint.
   - Recommendation: Start without a health check endpoint. If Railway marks the deploy as failed, add a minimal HTTP server on `PORT` (Railway's injected port variable) that returns 200 on GET /.

2. **Photo file_name Inference**
   - What we know: Photos sent as "photos" (not documents) lack `file_name` and `mime_type` in the Telegram API. They're always JPEG after compression.
   - What's unclear: Whether Claude API needs a specific filename when processing images in Phase 2.
   - Recommendation: Generate a filename like `photo_${timestamp}.jpg` for photos. This is a Phase 1 display concern only; Phase 2 will address Claude API requirements.

3. **Confirmation Flow for INP-03**
   - What we know: The requirement says "confirms before processing." Phase 1 only receives and acknowledges files; actual processing comes in Phase 2.
   - What's unclear: Whether confirmation needs inline keyboard buttons or just a text prompt.
   - Recommendation: For Phase 1, display file details and state "Ready to process this file?" as a text message. Phase 2 can add inline keyboard confirmation if needed.

## Sources

### Primary (HIGH confidence)
- grammY official docs (grammy.dev) - Getting started, filter queries, files, context, errors, deployment, structuring
- Telegram Bot API docs (core.telegram.org/bots/api) - Document type, PhotoSize type, getFile limits
- Pino npm package (npmjs.com/package/pino) - v10.3.1, structured logging API
- grammY npm package (npmjs.com/package/grammy) - v1.40.0
- @grammyjs/files npm package (npmjs.com/package/@grammyjs/files) - v1.2.0

### Secondary (MEDIUM confidence)
- Railway docs (docs.railway.com) - Variable management, deployment reference, health checks
- Better Stack Pino guide (betterstack.com) - Pino vs Winston benchmarks, child logger patterns
- SigNoz Pino guide (signoz.io/guides/pino-logger/) - TypeScript setup patterns

### Tertiary (LOW confidence)
- Railway health check behavior with non-HTTP services - needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified on npm with current versions, official docs consulted
- Architecture: HIGH - Patterns directly from grammY official structuring docs and Pino best practices
- Pitfalls: HIGH - Photo/document distinction verified against Telegram Bot API; graceful shutdown from grammY deployment docs; file_size optionality from TypeScript types

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain; grammY and Pino are mature libraries)
