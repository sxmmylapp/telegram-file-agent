# Stack Research

**Domain:** Telegram bot with AI-powered document processing, iCloud Drive integration, PDF generation
**Researched:** 2026-02-19
**Confidence:** HIGH (core stack), MEDIUM (iCloud integration approach)

## Critical Architecture Note: iCloud Drive Access from Railway

**This is the single most important stack decision for the project.**

iCloud Drive files live on the local Mac at `~/Library/Mobile Documents/com~apple~CloudDocs/`. Railway is a remote server. Apple provides NO public API for accessing iCloud Drive files remotely -- CloudKit only accesses app-specific data, not Drive files. This constrains the architecture to one of two patterns:

**Recommended: Hybrid Architecture (Local Agent + Railway Bot)**
- A lightweight local agent runs on Sammy's Mac, serving files over a secure tunnel or API
- The Telegram bot runs on Railway, handling all bot logic and AI processing
- When the bot needs a file, it requests it from the local agent
- This is the only reliable, long-term approach

**Alternative: rclone on Railway (Fragile)**
- rclone supports iCloud Drive but requires re-authentication every 30 days via 2FA
- This will break regularly and require manual intervention
- NOT recommended for a tool meant to "just work"

**Simplest MVP: Run everything locally on the Mac**
- Use `tsx` to run the bot process locally
- Direct filesystem access to iCloud Drive
- No remote hosting complexity
- Upgrade to hybrid architecture later when a local agent pattern is proven

**Recommendation:** Start with local-only for MVP. The bot is a single-user personal tool. Running locally on the Mac gives direct iCloud Drive access with zero complexity. Add Railway deployment later with a local file-serving agent if remote access becomes needed.

---

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Current LTS with ES module support; Railway auto-detects and supports it natively |
| TypeScript | 5.9.x | Language | grammY is TypeScript-first with excellent type inference; catches document processing edge cases at compile time |
| tsx | 4.21.x | Dev runner | Run TypeScript directly without build step; perfect for rapid iteration on a personal tool |

**Confidence:** HIGH -- verified via npm registry (TypeScript 5.9.3, tsx 4.21.0)

### Telegram Bot Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| grammY | 1.40.0 | Telegram Bot API framework | Modern, TypeScript-first, actively maintained (published 10 days ago). Better types than Telegraf, lighter than node-telegram-bot-api, excellent plugin ecosystem |
| @grammyjs/files | 1.2.0 | File download helper | Simplifies downloading files users send to the bot (PDFs, images, docs) |
| @grammyjs/conversations | 2.1.1 | Multi-step interactions | Handles conversational flows like "search for X, then summarize Y" naturally |
| @grammyjs/runner | 2.0.3 | Long polling runner | Graceful shutdown, error recovery for persistent bot process |

**Confidence:** HIGH -- verified versions via npm. grammY has 57K weekly downloads, 3K+ GitHub stars, and is the most actively developed Telegram bot framework for TypeScript.

**Why grammY over Telegraf:** Telegraf (156K weekly downloads) has more downloads but grammY was designed from scratch with TypeScript and has better type safety, cleaner middleware API, and more actively maintained plugin ecosystem. Telegraf v4 migrated to TypeScript but carries legacy baggage. For a new project in 2026, grammY is the right choice.

**Why NOT node-telegram-bot-api:** Dead simple event emitter that works for trivial bots, but lacks middleware, conversations, and plugin support needed for multi-step document workflows.

### AI / LLM Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @anthropic-ai/sdk | 0.78.0 | Claude API client | Official Anthropic SDK with native PDF support, vision (image OCR), and structured output. Direct from the source. |

**Confidence:** HIGH -- verified via npm. Official Anthropic SDK.

**Key capability that simplifies the entire stack:** Claude's API natively accepts PDFs (base64 or Files API) and images. This means:
- **PDF parsing for summarization**: Send PDFs directly to Claude. No need for `pdf-parse` or `pdfjs-dist` just to extract text for summarization. Claude handles both text and visual content (charts, tables, diagrams). Limit: 32MB, 100 pages per request.
- **Image OCR**: Claude's vision achieves ~2.1% Character Error Rate on printed text -- competitive with specialized OCR. Send images directly as base64. No Tesseract.js needed for the summarization use case.
- **Token costs**: 1,500-3,000 tokens per PDF page. For a personal tool processing occasional documents, this is negligible.

**When you still need local parsing:** If you need to search/index file contents locally (e.g., building a file search index), you will need local parsing libraries. See "Supporting Libraries" below.

### Document Parsing (for local file search/indexing)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pdf-parse | 2.4.5 | PDF text extraction (local) | Pure JS, zero native deps, simple API. Use for building search index, NOT for Claude summarization (send PDF directly to Claude instead) |
| mammoth | 1.11.0 | Word .docx to text/HTML | Best-in-class DOCX parser. `extractRawText()` for indexing, HTML conversion for rich display |
| xlsx (SheetJS) | 0.18.5 | Excel/CSV parsing | Industry standard spreadsheet parser. `sheet_to_json()` for structured data extraction. Lightweight -- only need read, not write |
| officeparser | 6.0.4 | Multi-format fallback | Parses docx, pptx, xlsx, odt, pdf, rtf in one library. Use as fallback for unusual formats. v6 added AST output with rich metadata |
| sharp | 0.34.5 | Image preprocessing | Resize/convert images before sending to Claude vision. Reduces token costs and improves OCR accuracy on large images |

**Confidence:** HIGH for mammoth, xlsx. MEDIUM for pdf-parse (last publish Oct 2025, originally from 2018 -- works fine but low maintenance cadence). HIGH for officeparser (v6.0.4, actively maintained with Dec 2025 major release).

### PDF Generation (output)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PDFKit | 0.17.2 | Generate executive summary PDFs | Programmatic PDF creation with precise control over layout, fonts, headers, footers. No browser dependency. Streaming API for memory efficiency. |

**Confidence:** HIGH -- PDFKit is the standard for server-side PDF generation in Node.js when you need programmatic control. Verified version via npm.

**Why PDFKit over Puppeteer:** Puppeteer requires a headless Chrome instance (~400MB), which is wasteful on Railway for generating simple text-heavy summary documents. PDFKit is pure JS, lightweight, and gives precise control. Use Puppeteer only if you need to render complex HTML/CSS layouts -- which executive summaries do not require.

**Why NOT pdf-lib:** pdf-lib (1.17.1) is excellent for modifying existing PDFs (merge, split, edit). But for creating new PDFs from scratch, PDFKit has a more intuitive canvas-like API and better text layout support.

### File System & Search

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| globby | latest | File discovery | Find files matching patterns across iCloud Drive's messy folder structure. Async, fast, supports negation patterns |
| Node.js `fs/promises` | built-in | File I/O | Native async filesystem access. No external dependency needed for reading files from iCloud Drive path |

**Confidence:** HIGH -- standard Node.js patterns.

**iCloud Drive path:** `~/Library/Mobile Documents/com~apple~CloudDocs/`
Note: The space in "Mobile Documents" requires proper path handling. Always use `path.join()` or template literals, never string concatenation with shell commands.

### Logging

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pino | 10.3.x | Structured logging | Fastest Node.js logger. JSON output works perfectly with Railway's log viewer. Leveled (DEBUG/INFO/WARN/ERROR). Per Sammy's logging standard requirements. |
| pino-pretty | latest | Dev log formatting | Human-readable log output during local development |

**Confidence:** HIGH -- pino is the performance leader. Winston (3.19.0) is the alternative with more transports, but pino's speed and simplicity win for a single-service bot.

### Configuration & Validation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| zod | 4.3.x | Runtime validation | Validate environment variables, API responses, user input. TypeScript-native schema validation |
| dotenv | latest | Environment variables | Load .env files locally. Railway injects env vars in production |

**Confidence:** HIGH -- industry standard. Zod 4.3.6 verified via npm.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Run TypeScript directly | `tsx watch src/index.ts` for dev with auto-reload |
| TypeScript | Type checking | `tsc --noEmit` for CI checks |
| ESLint | Linting | Flat config with `@typescript-eslint/eslint-plugin` |
| Prettier | Formatting | Consistent code style |

---

## Installation

```bash
# Core dependencies
npm install grammy @grammyjs/files @grammyjs/conversations @grammyjs/runner @anthropic-ai/sdk pdfkit sharp pino zod dotenv

# Document parsing (for local search/indexing)
npm install pdf-parse mammoth xlsx officeparser

# Dev dependencies
npm install -D typescript tsx @types/node @types/pdfkit pino-pretty eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Telegram framework | grammY | Telegraf 4.x | If migrating an existing Telegraf bot; not for greenfield |
| Telegram framework | grammY | node-telegram-bot-api | If building a trivial single-command bot with no conversation flow |
| PDF parsing | Claude API native | pdf-parse + pdfjs-dist | If you need to index/search PDF content locally without calling Claude |
| Image OCR | Claude API vision | Tesseract.js 7.0 | If you need offline OCR without API costs, or processing hundreds of images in batch |
| PDF generation | PDFKit | Puppeteer | If generating PDFs from complex HTML templates with CSS layouts |
| PDF generation | PDFKit | pdf-lib | If modifying/merging existing PDFs rather than creating new ones |
| Spreadsheets | xlsx (SheetJS) | ExcelJS 4.4.0 | If you need to write Excel files with formatting; xlsx is lighter for read-only |
| DOCX parsing | mammoth | officeparser | If parsing multiple Office formats and want one library |
| Logging | pino | Winston 3.19.0 | If you need many log transports (email, Slack, etc.); pino is faster for stdout/file |
| iCloud access | Local filesystem | rclone | If you absolutely must run on Railway; requires 30-day re-auth cycle |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tesseract.js for primary OCR | 50MB+ WASM binary, slower and less accurate than Claude vision for this use case. Adds complexity without benefit when you're already calling Claude for summarization | Claude API vision -- send images directly as base64 |
| Puppeteer for PDF generation | 400MB+ Chrome binary. Overkill for text-heavy executive summaries. Adds massive container size on Railway | PDFKit -- pure JS, ~2MB, precise programmatic control |
| node-telegram-bot-api | No middleware, no conversation support, no plugin ecosystem. Will hit walls quickly with multi-step document workflows | grammY -- modern, typed, extensible |
| iCloud.js / apple-icloud npm | Community packages, last updated years ago. Fragile authentication, no official support | Direct filesystem access to ~/Library/Mobile Documents/com~apple~CloudDocs/ |
| CloudKit JS / CloudKit Web Services | Only accesses app-specific CloudKit containers, NOT iCloud Drive files. Common misconception -- CloudKit cannot read Drive files | Direct filesystem access or rclone for remote scenarios |
| pdf2json | Heavier than pdf-parse, complex JSON output format. Good for spatial analysis but overkill for text extraction | pdf-parse for simple text, Claude API for full document understanding |

## Stack Patterns by Deployment

**If running locally on Mac (recommended for MVP):**
- Direct `fs` access to `~/Library/Mobile Documents/com~apple~CloudDocs/`
- `tsx watch` for development
- Long polling via `@grammyjs/runner`
- No container/deployment complexity
- Process manager: `launchd` plist or `pm2` for persistence

**If deploying to Railway (future):**
- Need a local file agent running on Mac that exposes an API
- Railway bot calls local agent via secure tunnel (Cloudflare Tunnel, ngrok, or Tailscale)
- Agent handles file search and streams file content to Railway
- Bot handles Telegram interaction and Claude API calls
- More moving parts but enables remote access

**If using rclone sync (not recommended):**
- Set up rclone with iCloud Drive remote
- Sync iCloud Drive to Railway persistent volume on schedule
- Re-authenticate every 30 days manually
- Files may be stale between syncs

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| grammy@1.40.0 | Node.js 18+ | Uses ES modules and modern JS features |
| @anthropic-ai/sdk@0.78.0 | Node.js 18+ | TypeScript 4.9+ required for full type support |
| sharp@0.34.5 | Node.js 18.17+ | Requires libvips (auto-installed via prebuilt binaries) |
| pdfkit@0.17.2 | Node.js 14+ | Broadly compatible |
| tesseract.js@7.0.0 | Node.js 18+ | Only if needed as fallback; large WASM binary |
| TypeScript@5.9.3 | Node.js 18+ | |
| xlsx@0.18.5 | Node.js 12+ | Broadly compatible |

## Key Version: Node.js 22 LTS

All recommended packages support Node.js 22. This is the target runtime.

Railway supports Node.js 22 via Railpack auto-detection or explicit `engines` field in `package.json`:
```json
{
  "engines": {
    "node": "22"
  }
}
```

## Telegram Bot API Constraints

| Constraint | Limit | Impact |
|------------|-------|--------|
| File download | 20 MB | Bot can only download files up to 20MB sent by users |
| File upload/send | 50 MB | Generated PDFs must be under 50MB (executive summaries will be well under this) |
| Message length | 4096 chars | Long summaries need to be split or sent as documents |
| Inline keyboard buttons | 8 per row | UI layout constraint for file selection |

## Claude API Constraints

| Constraint | Limit | Impact |
|------------|-------|--------|
| PDF size | 32 MB per request | Large scanned documents may need splitting |
| PDF pages | 100 per request | Split large documents |
| Image size | 5 MB recommended | Use sharp to resize before sending |
| Token cost per PDF page | 1,500-3,000 tokens | Budget ~$0.01-0.03 per page with Sonnet |
| Context window | 200K tokens (Sonnet) | Can process ~60-100 pages of dense text in one request |

## Sources

- [grammY official site](https://grammy.dev/) -- framework features, plugin ecosystem (HIGH confidence)
- [grammY comparison page](https://grammy.dev/resources/comparison) -- vs Telegraf and NTBA (HIGH confidence)
- [npm trends: grammy vs telegraf vs node-telegram-bot-api](https://npmtrends.com/grammy-vs-node-telegram-bot-api-vs-telegraf-vs-telegram-bot-api) -- download statistics (HIGH confidence)
- [Claude API PDF support docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- native PDF handling, limits, best practices (HIGH confidence)
- [Claude API Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) -- image processing capabilities (HIGH confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- official SDK (HIGH confidence)
- [rclone iCloud Drive docs](https://rclone.org/iclouddrive/) -- remote iCloud access, 30-day token limitation (HIGH confidence)
- [Apple CloudKit documentation](https://developer.apple.com/documentation/cloudkitjs) -- confirmed CloudKit cannot access Drive files (HIGH confidence)
- [iCloud Drive local path discussion](https://eclecticlight.co/2024/03/18/how-icloud-drive-works-in-macos-sonoma/) -- ~/Library/Mobile Documents/ path (MEDIUM confidence)
- [Railway Node.js deployment guide](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) -- deployment patterns (HIGH confidence)
- [PDFBolt: Top PDF Generation Libraries 2025](https://pdfbolt.com/blog/top-nodejs-pdf-generation-libraries) -- PDFKit vs Puppeteer comparison (MEDIUM confidence)
- [Strapi: 7 PDF Parsing Libraries](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025) -- pdf-parse vs alternatives (MEDIUM confidence)
- [Claude Vision vs OCR comparison](https://sparkco.ai/blog/deepseek-ocr-vs-claude-vision-a-deep-dive-into-accuracy) -- CER benchmarks (MEDIUM confidence)
- npm registry (verified all package versions directly via `npm view`) -- (HIGH confidence)

---
*Stack research for: Telegram File Agent*
*Researched: 2026-02-19*
