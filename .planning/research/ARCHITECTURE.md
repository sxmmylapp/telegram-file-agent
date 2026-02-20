# Architecture Research

**Domain:** Telegram-controlled AI file agent with document summarization
**Researched:** 2026-02-19
**Confidence:** HIGH

## Critical Architecture Decision: Split-Process vs Monolith

The single most important architectural decision for this project is how the Telegram bot (hosted on Railway) accesses files on iCloud Drive (local to the Mac).

**iCloud Drive files live at `~/Library/Mobile Documents/com~apple~CloudDocs/` on macOS.** There is no public API for remote iCloud Drive access from a server. Files may be "evicted" (cloud-only stubs) and need `brctl download` to materialize locally.

**Recommendation: Start monolith on Railway, use iCloud Drive sync as a local-only file source with a lightweight local relay agent added later.**

For MVP, the simplest architecture that works: the bot runs on Railway and the user sends/forwards documents directly via Telegram chat. The bot processes what it receives. iCloud Drive search is deferred to a later phase when a local agent can be added to the Mac that exposes file search over a secure tunnel.

**Rationale:** Building the core pipeline (receive doc -> parse -> summarize -> generate PDF -> send back) is the highest-value work. iCloud Drive access is a separate concern that adds significant complexity (local agent, tunnel, file sync, eviction handling). Ship the conversational pipeline first, add file access second.

## System Overview

```
Phase 1 (MVP): Direct Document Pipeline
========================================

┌──────────────┐     ┌─────────────────────────────────────────────┐
│   Telegram   │     │              Railway (Node.js)               │
│   (Sammy)    │     │                                              │
│              │     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  Send docs ──┼────>│  │ Bot      │→ │ Parser   │→ │ Claude   │  │
│              │     │  │ Handler  │  │ Service  │  │ Service  │  │
│  Get PDF  <──┼─────│  │          │← │          │← │          │  │
│              │     │  └──────────┘  └──────────┘  └──────────┘  │
│              │     │       ↕                            │        │
│              │     │  ┌──────────┐              ┌──────────┐    │
│              │     │  │ Session  │              │ PDF Gen  │    │
│              │     │  │ Store    │              │ Service  │    │
│              │     │  └──────────┘              └──────────┘    │
└──────────────┘     └─────────────────────────────────────────────┘

Phase 2 (Enhanced): + Local File Agent
=======================================

┌──────────────┐     ┌──────────────────────────────────────────┐
│   Telegram   │     │           Railway (Node.js)               │
│   (Sammy)    │     │                                           │
│              │     │  ┌──────────┐  ┌──────────┐              │
│  "Find the ──┼────>│  │ Bot      │→ │ File     │──┐           │
│   lease for  │     │  │ Handler  │  │ Router   │  │           │
│   123 Main"  │     │  └──────────┘  └──────────┘  │           │
│              │     │                    │          │           │
│              │     │                    ▼          ▼           │
│              │     │              ┌──────────┐ ┌──────────┐   │
│              │     │              │ Parser   │ │ Claude   │   │
│              │     │              │ Service  │ │ Service  │   │
│              │     │              └──────────┘ └──────────┘   │
│              │     │                               │          │
│              │     │                          ┌──────────┐    │
│              │     │                          │ PDF Gen  │    │
│              │     │                          └──────────┘    │
└──────────────┘     └──────────────┬───────────────────────────┘
                                    │ HTTPS/WSS
                     ┌──────────────▼───────────────────────────┐
                     │        Mac (Local Agent)                  │
                     │                                           │
                     │  ┌──────────┐  ┌──────────┐              │
                     │  │ File     │→ │ iCloud   │              │
                     │  │ Search   │  │ Drive    │              │
                     │  │ API      │  │ Access   │              │
                     │  └──────────┘  └──────────┘              │
                     │       │                                   │
                     │  ~/Library/Mobile Documents/              │
                     │  com~apple~CloudDocs/                     │
                     └───────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Bot Handler | Receive Telegram messages, route commands, manage conversation flow, send responses | grammY framework with middleware chain |
| Session Store | Track conversation state per user (current request, confirmation pending, etc.) | In-memory for single user; Redis if scaling needed |
| Parser Service | Extract text content from multiple document formats (PDF, images, XLSX, DOCX) | Format-specific parsers with unified interface |
| Claude Service | Send extracted content to Claude API for summarization, interpret natural language queries | Anthropic SDK with prompt templates |
| PDF Generator | Create formatted executive summary PDFs from Claude's output | Puppeteer (HTML-to-PDF) for rich formatting |
| File Router | Determine file source (direct upload vs iCloud search) and dispatch accordingly | Strategy pattern, added in Phase 2 |
| File Search API | Search iCloud Drive by filename/content keywords, handle eviction/download | Local Express server on Mac, added in Phase 2 |
| iCloud Drive Access | Read files from `~/Library/Mobile Documents/com~apple~CloudDocs/`, handle `.icloud` stubs | Node.js fs + child_process for `brctl download` |

## Recommended Project Structure

```
src/
├── bot/                    # Telegram bot layer
│   ├── index.ts            # Bot initialization, middleware setup
│   ├── handlers/           # Message and command handlers
│   │   ├── document.ts     # Handle incoming documents
│   │   ├── search.ts       # Handle search requests (Phase 2)
│   │   ├── confirm.ts      # Handle confirmation flow
│   │   └── help.ts         # Help and status commands
│   └── middleware/          # Auth, logging, error handling
│       ├── auth.ts         # Restrict to Sammy's user ID
│       └── logging.ts      # Request/response logging
├── services/               # Business logic layer
│   ├── parser/             # Document parsing
│   │   ├── index.ts        # Parser dispatcher (by file type)
│   │   ├── pdf.ts          # PDF text extraction
│   │   ├── image.ts        # Image OCR via Claude Vision
│   │   ├── spreadsheet.ts  # XLSX/CSV parsing
│   │   └── docx.ts         # Word document parsing
│   ├── claude/             # Claude API integration
│   │   ├── index.ts        # Client setup, shared config
│   │   ├── summarize.ts    # Document summarization prompts
│   │   └── search.ts       # Natural language query interpretation (Phase 2)
│   ├── pdf-gen/            # PDF generation
│   │   ├── index.ts        # Generate executive summary PDF
│   │   └── templates/      # HTML templates for PDF layout
│   └── files/              # File access abstraction (Phase 2)
│       ├── index.ts        # File source router
│       ├── telegram.ts     # Files received via Telegram
│       └── icloud.ts       # iCloud Drive access via local agent
├── config/                 # Configuration
│   ├── index.ts            # Environment variable loading
│   └── prompts.ts          # Claude prompt templates
├── utils/                  # Shared utilities
│   ├── logger.ts           # Structured logging (pino)
│   └── errors.ts           # Custom error types
└── index.ts                # Entry point
```

### Structure Rationale

- **bot/:** Isolates Telegram-specific concerns. Handlers are thin -- they parse the incoming message and delegate to services. This means the core logic (parsing, summarization, PDF generation) is testable without Telegram.
- **services/:** Each service is a standalone module with a clear interface. The parser service dispatches to format-specific parsers. The Claude service owns all LLM interaction. This makes it easy to swap implementations or add formats.
- **services/files/:** Abstraction layer for file access. In Phase 1, only `telegram.ts` exists (files come directly from chat). In Phase 2, `icloud.ts` is added to route requests to the local agent. The router decides which source to use based on the request type.
- **config/prompts.ts:** Prompt templates are separated from code. This makes them easy to iterate on without touching business logic.

## Architectural Patterns

### Pattern 1: Message Pipeline

**What:** Each incoming Telegram message flows through a pipeline: authenticate -> log -> parse intent -> execute -> respond. The bot handler is a thin coordinator that delegates to services.

**When to use:** Every incoming message.

**Trade-offs:** Adds a small amount of indirection but keeps handlers testable and services reusable.

**Example:**
```typescript
// bot/handlers/document.ts
import { Context } from "grammy";
import { parseDocument } from "../../services/parser/index.js";
import { summarize } from "../../services/claude/summarize.js";
import { generatePdf } from "../../services/pdf-gen/index.js";
import { logger } from "../../utils/logger.js";

export async function handleDocument(ctx: Context) {
  const file = await ctx.getFile();
  const fileBuffer = await downloadFile(file);
  const mimeType = ctx.message?.document?.mime_type ?? "unknown";

  logger.info({ mimeType, fileId: file.file_id }, "Document received");

  // 1. Parse document to text
  const extracted = await parseDocument(fileBuffer, mimeType);

  // 2. Summarize with Claude
  const summary = await summarize(extracted);

  // 3. Generate PDF
  const pdfBuffer = await generatePdf(summary);

  // 4. Send back
  await ctx.replyWithDocument(new InputFile(pdfBuffer, "summary.pdf"), {
    caption: summary.headline,
  });
}
```

### Pattern 2: Format Dispatcher

**What:** A single `parseDocument()` function that routes to the correct parser based on MIME type. Each parser implements the same interface: `(buffer: Buffer) => Promise<ExtractedContent>`.

**When to use:** Whenever a new document format needs to be supported.

**Trade-offs:** Slight overhead of maintaining the dispatcher, but makes adding new formats trivial (add a parser, register it in the map).

**Example:**
```typescript
// services/parser/index.ts
type Parser = (buffer: Buffer) => Promise<ExtractedContent>;

const parsers: Record<string, Parser> = {
  "application/pdf": parsePdf,
  "image/jpeg": parseImage,
  "image/png": parseImage,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": parseSpreadsheet,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": parseDocx,
  "text/csv": parseCsv,
};

export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedContent> {
  const parser = parsers[mimeType];
  if (!parser) {
    throw new UnsupportedFormatError(mimeType);
  }
  return parser(buffer);
}
```

### Pattern 3: Confirmation Gate (Configurable)

**What:** Before generating and sending the final PDF, optionally ask the user to confirm. This is a state machine with two states: `idle` and `awaiting_confirmation`. Controlled by a config flag.

**When to use:** When `REQUIRE_CONFIRMATION=true` in config.

**Trade-offs:** Adds conversation state management. For a single-user bot this is simple (in-memory state), but must be handled carefully to avoid stuck states.

**Example:**
```typescript
// Simple state machine for confirmation flow
interface ConversationState {
  status: "idle" | "awaiting_confirmation";
  pendingSummary?: SummaryResult;
  pendingDocuments?: ExtractedContent[];
}

// In the handler:
if (config.requireConfirmation) {
  state.status = "awaiting_confirmation";
  state.pendingSummary = summary;
  await ctx.reply(
    `Summary preview:\n\n${summary.headline}\n\n${summary.keyPoints.join("\n")}\n\nGenerate PDF? (yes/no)`
  );
} else {
  // Skip confirmation, generate immediately
  const pdf = await generatePdf(summary);
  await ctx.replyWithDocument(new InputFile(pdf, "summary.pdf"));
}
```

### Pattern 4: Claude-as-OCR for Images

**What:** Instead of running a separate OCR engine (Tesseract), send images directly to Claude Vision API for text extraction. Claude handles OCR natively with better accuracy than traditional OCR for document images.

**When to use:** For image files (JPEG, PNG) that contain document text.

**Trade-offs:** Higher cost per image (~$0.004/image at 1MP) and requires API call, but eliminates Tesseract binary dependency and provides superior accuracy, especially for complex layouts. For a single-user personal tool processing occasional documents, cost is negligible.

**Example:**
```typescript
// services/parser/image.ts
import Anthropic from "@anthropic-ai/sdk";

export async function parseImage(buffer: Buffer): Promise<ExtractedContent> {
  const client = new Anthropic();
  const base64 = buffer.toString("base64");
  const mediaType = detectMediaType(buffer); // "image/jpeg" | "image/png" etc.

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",  // Sonnet for cost-effective OCR
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 }
        },
        {
          type: "text",
          text: "Extract all text from this document image. Preserve structure, headings, and formatting."
        }
      ]
    }]
  });

  return { text: response.content[0].text, source: "image-ocr" };
}
```

## Data Flow

### Primary Flow: Document Summarization

```
User sends document(s) via Telegram
    |
    v
Bot Handler receives message with file_id(s)
    |
    v
Download file(s) via Telegram Bot API (max 20MB each)
    |
    v
Parser Service: detect MIME type -> dispatch to format parser
    |
    ├── PDF:   pdf-parse extracts text (or Claude Vision for scanned PDFs)
    ├── Image: Claude Vision API extracts text (OCR)
    ├── XLSX:  SheetJS extracts cell data -> flatten to text
    └── DOCX:  mammoth extracts text + structure
    |
    v
Claude Service: send extracted text(s) with summarization prompt
    |
    ├── Single doc: "Summarize this document for a real estate professional"
    └── Multi doc:  "Summarize these N documents together. Cross-reference."
    |
    v
[Optional] Confirmation gate: preview summary, wait for "yes"
    |
    v
PDF Generator: render summary as executive PDF
    ├── HTML template with summary content
    └── Puppeteer converts HTML -> PDF buffer
    |
    v
Bot sends PDF back via Telegram
    └── ctx.replyWithDocument(pdfBuffer)
```

### Phase 2 Flow: iCloud Drive Search

```
User sends natural language query: "Find the lease for 123 Main St"
    |
    v
Bot Handler detects search intent (not a file upload)
    |
    v
Claude Service: interpret query -> extract search parameters
    ├── Keywords: "lease", "123 Main St"
    ├── File types: PDF, DOCX
    └── Date hints: (none)
    |
    v
File Router: dispatch to iCloud agent
    |
    v
HTTPS request to Local Agent on Mac (via tunnel)
    |
    v
Local Agent: search iCloud Drive
    ├── Walk ~/Library/Mobile Documents/com~apple~CloudDocs/
    ├── Match filenames against keywords
    ├── Handle .icloud stubs: brctl download to materialize
    └── Return matching file(s) as buffers
    |
    v
(Continues with Parser -> Claude -> PDF Gen -> Send flow)
```

### Key Data Flows

1. **File ingestion:** Telegram file_id -> getFile() -> download URL -> Buffer. This is the entry point for all document processing. The 20MB Telegram limit is acceptable for typical real estate documents.

2. **Text extraction:** Buffer + MIME type -> format-specific parser -> ExtractedContent (text + metadata). The unified `ExtractedContent` type is the contract between parsing and summarization.

3. **Summarization:** ExtractedContent[] -> Claude prompt -> SummaryResult (headline, key points, full summary, metadata). The prompt template is parameterized for single vs. multi-document scenarios.

4. **PDF generation:** SummaryResult -> HTML template rendering -> Puppeteer PDF -> Buffer. The HTML template controls formatting, branding, and layout.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (current) | In-memory session state, long polling, monolith process on Railway. No database needed. All state is transient. |
| 2-5 users | Add SQLite or Redis for session state. Add user ID allowlist to auth middleware. Still monolith. |
| 10+ users | Add job queue (BullMQ + Redis) for document processing. Webhook mode instead of long polling. Separate worker process for heavy parsing/summarization. |

### Scaling Priorities

1. **First bottleneck:** Claude API response time. Document summarization takes 5-30 seconds depending on document size. For a single user this is fine (just wait). For multiple concurrent users, add a job queue so the bot remains responsive while processing happens in the background.

2. **Second bottleneck:** PDF generation via Puppeteer. Launching a browser is memory-intensive (~100MB per instance). For single user, reuse a single browser instance. For scale, use a pool or switch to PDFKit for simpler layouts.

3. **Not a bottleneck:** Telegram Bot API. For a personal tool, message volume is negligible. Long polling is perfectly adequate.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Handler Functions

**What people do:** Put all logic (parsing, Claude calls, PDF generation, Telegram response) in a single handler function.

**Why it's wrong:** Impossible to test individual steps, impossible to reuse logic, errors in one step crash the entire handler with no graceful recovery.

**Do this instead:** Thin handlers that delegate to services. Each service is independently testable and has its own error handling.

### Anti-Pattern 2: Synchronous File Processing in Bot Event Loop

**What people do:** Perform heavy file processing (OCR, PDF generation) directly in the message handler, blocking the bot from receiving new messages.

**Why it's wrong:** The bot becomes unresponsive during processing. For a single user with occasional requests this is tolerable, but it creates a poor UX and prevents the bot from acknowledging receipt.

**Do this instead:** Immediately acknowledge the message ("Processing your document..."), then process asynchronously. Send the result when ready. Even without a job queue, use async/await properly.

### Anti-Pattern 3: Storing Sensitive Files on Railway Disk

**What people do:** Save uploaded documents to Railway's filesystem and assume they persist.

**Why it's wrong:** Railway containers are ephemeral. Disk is wiped on redeploy. You lose all files.

**Do this instead:** Process documents in memory (Buffer). Never write to disk except for temporary Puppeteer operations (which should be cleaned up). If persistence is needed later, use Railway Volumes or external storage.

### Anti-Pattern 4: Using Tesseract for OCR When Claude Vision Exists

**What people do:** Install Tesseract binaries, manage language packs, deal with image preprocessing -- all for OCR.

**Why it's wrong:** Tesseract requires native binaries (pain on Railway), has mediocre accuracy on complex layouts, and needs image preprocessing. Claude Vision handles OCR natively with better accuracy, especially for documents.

**Do this instead:** Send images directly to Claude Vision API. It costs a fraction of a cent per image and handles complex layouts, tables, handwriting, and multi-language documents far better than Tesseract.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram Bot API | grammY SDK, long polling (MVP) | 20MB download limit per file. Use `@grammyjs/files` plugin for simplified downloads. Bot token stored in env var. |
| Claude API (Anthropic) | `@anthropic-ai/sdk`, Messages API | PDFs via base64 document blocks. Images via base64 image blocks. Max 32MB request, 100 pages per PDF. Use `claude-sonnet-4-20250514` for cost-effective summarization; `claude-opus-4-6` only if quality demands it. |
| Puppeteer (PDF gen) | `puppeteer` with `--no-sandbox` on Railway | Use `puppeteer-core` + `@sparticuz/chromium` for Railway deployment to avoid bundling full Chrome. Reuse browser instance. |
| Railway | Dockerfile deployment, env vars via dashboard | Use `Dockerfile` for Puppeteer binary control. Set `NODE_ENV=production`. Use health checks to prevent Railway from killing the process. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Bot Handler <-> Services | Direct function calls (in-process) | All in same Node.js process. No IPC overhead. |
| Railway Bot <-> Local Agent (Phase 2) | HTTPS with shared secret / API key | Local agent runs Express server, exposed via Cloudflare Tunnel or ngrok. Bot authenticates with a pre-shared token. |
| Parser <-> Claude Vision | HTTP via Anthropic SDK | For images and scanned PDFs only. Text-based PDFs use pdf-parse locally (no API call needed). |

## Build Order (Dependency Chain)

This is the critical ordering that informs the roadmap.

```
1. Bot skeleton + auth
   (grammY setup, Telegram connection, user ID restriction)
   └── No dependencies. Must work first.

2. Document reception + text extraction
   (Download files from Telegram, parse PDF/DOCX/XLSX)
   └── Depends on: bot skeleton

3. Claude summarization
   (Send extracted text to Claude, get structured summary)
   └── Depends on: text extraction (needs content to summarize)

4. PDF generation
   (Render summary as PDF, send back via Telegram)
   └── Depends on: summarization (needs summary content)

5. Confirmation flow
   (Optional gate between summary and PDF gen)
   └── Depends on: summarization + PDF gen (adds state between them)

6. Image OCR via Claude Vision
   (Extends parser to handle image documents)
   └── Depends on: bot skeleton + Claude service (reuses both)

7. Multi-document summarization
   (Batch multiple docs into single summary)
   └── Depends on: single-doc flow working end-to-end

8. iCloud Drive local agent (Phase 2)
   (Search and retrieve files from Mac)
   └── Depends on: entire Phase 1 pipeline working
```

## Sources

- [Anthropic Claude API - PDF Support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- HIGH confidence, official docs
- [Anthropic Claude API - Vision](https://platform.claude.com/docs/en/build-with-claude/vision) -- HIGH confidence, official docs
- [Anthropic Claude API - Files API](https://platform.claude.com/docs/en/build-with-claude/files) -- HIGH confidence, official docs
- [grammY File Handling Guide](https://grammy.dev/guide/files) -- HIGH confidence, official docs
- [grammY Framework Comparison](https://grammy.dev/resources/comparison) -- HIGH confidence, official docs
- [iCloud Drive Local Path on macOS](https://eclecticlight.co/2024/03/18/how-icloud-drive-works-in-macos-sonoma/) -- MEDIUM confidence, well-known macOS resource
- [brctl download for evicted files](https://techgarden.alphasmanifesto.com/mac/Manually-downloading-or-evicting-iCloud-files) -- MEDIUM confidence, community resource
- [Railway Telegram Bot Templates](https://railway.com/template/aOqPSI) -- MEDIUM confidence, official Railway templates
- [OfficeParser for multi-format parsing](https://github.com/harshankur/officeParser) -- MEDIUM confidence, active GitHub project
- [Building a Scalable Telegram Bot](https://medium.com/@pushpesh0/building-a-scalable-telegram-bot-with-node-js-bullmq-and-webhooks-6b0070fcbdfc) -- LOW confidence, single blog post

---
*Architecture research for: Telegram-controlled AI file agent with document summarization*
*Researched: 2026-02-19*
