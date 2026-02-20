# Project Research Summary

**Project:** Telegram File Agent
**Domain:** Telegram bot with AI-powered document processing for real estate
**Researched:** 2026-02-19
**Confidence:** MEDIUM (HIGH on stack and architecture, MEDIUM on iCloud Drive access strategy)

## Executive Summary

The Telegram File Agent is a single-user personal tool that lets a real estate professional chat with a Telegram bot to find, read, and summarize documents scattered across iCloud Drive. The core pipeline is: receive/find document -> parse content -> summarize via Claude API -> generate PDF -> deliver via Telegram. Experts build this as a straightforward message pipeline with format-specific parsers feeding into an LLM summarization layer, using grammY (TypeScript-first Telegram framework) and the Anthropic SDK which natively handles PDFs and images without needing separate OCR or PDF parsing for the summarization use case.

The single most critical finding across all research is that **iCloud Drive has no server-side API**. Apple provides zero way to access Drive files from a Linux server like Railway. The PROJECT.md assumes "iCloud Drive API" exists -- it does not. This fundamentally changes the architecture. The recommended approach for MVP is to **run the bot locally on the Mac** where iCloud Drive files are directly accessible via the filesystem, or to **start with Telegram-uploaded documents only** (user sends files to the bot) and defer iCloud Drive search to a later phase that adds a local Mac agent connected via secure tunnel. Either way, the iCloud Drive access problem must be resolved as an architectural decision before writing code.

Beyond the iCloud problem, the technical risks are manageable. Claude's native PDF and vision support eliminates the need for Tesseract OCR or complex PDF parsing pipelines for summarization. PDFKit handles output PDF generation without a heavy Puppeteer/Chrome dependency. Telegram's 20MB download limit will occasionally block large scanned documents but is workable for most real estate files. The main ongoing risk is uncontrolled Claude API costs on large documents -- token estimation and budget gates must be built into the pipeline from the start.

## Key Findings

### Recommended Stack

The stack centers on TypeScript/Node.js with grammY as the Telegram framework and the Anthropic SDK for all AI processing. A key insight: Claude's API natively accepts PDFs (up to 32MB, 100 pages) and images, so the traditional pattern of "extract text with pdf-parse, then send text to LLM" is unnecessary for the summarization use case. Send documents directly to Claude. Local parsing libraries (pdf-parse, mammoth, xlsx) are only needed if building a file search index.

**Core technologies:**
- **grammY 1.40.0**: Telegram bot framework -- TypeScript-first, modern middleware API, excellent plugin ecosystem (conversations, file downloads, runner)
- **@anthropic-ai/sdk 0.78.0**: Claude API client -- native PDF support, vision/OCR, structured output. The only AI dependency needed.
- **PDFKit 0.17.2**: PDF generation -- pure JS, no browser dependency, precise programmatic control. Lightweight alternative to Puppeteer.
- **pino 10.3.x**: Structured JSON logging -- meets Sammy's logging standard, fastest Node.js logger
- **zod 4.3.x**: Runtime validation -- environment config, API response validation, user input
- **TypeScript 5.9.x + tsx 4.21.x**: Language and dev runner -- run TypeScript directly, no build step for development

**Document parsing (for local indexing, not for Claude summarization):**
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX parsing
- **xlsx (SheetJS)**: Spreadsheet parsing
- **sharp**: Image preprocessing before Claude vision

### Expected Features

**Must have (table stakes -- the core loop):**
- Telegram command interface (`/search`, `/summarize`, `/help`)
- File reception (user sends docs via Telegram chat)
- PDF text extraction and multi-format parsing
- Claude API document summarization
- Confirmation step before consuming API tokens
- Summary delivered as Telegram message (text first, PDF generation later)
- Error handling with structured logging
- User ID auth guard (restrict to Sammy only)

**Should have (add after core loop works):**
- Executive summary PDF generation and delivery
- Image OCR via Claude Vision (scanned documents)
- Word doc and spreadsheet parsing
- Real estate domain-aware summary prompts (extract dates, prices, parties, contingencies)
- Summary caching (hash-based dedup to save API costs)
- Save generated PDF back to source folder
- Custom summary templates (client-facing vs. internal)

**Defer (v2+):**
- iCloud Drive search (requires local agent architecture)
- Semantic file search (vector embeddings, indexing infrastructure)
- Multi-document summarization (context window management)
- Scheduled folder monitoring
- Conversation memory / session context
- Batch processing
- Document type auto-classification

### Architecture Approach

The architecture is a message pipeline: Bot Handler -> Parser Service -> Claude Service -> PDF Generator -> Telegram response. For MVP, the bot should accept documents uploaded directly via Telegram chat (no iCloud Drive access needed). This avoids the iCloud problem entirely and lets the team ship the highest-value feature -- document summarization -- immediately. iCloud Drive search is added in Phase 2 via a local agent running on the Mac that serves files over a secure tunnel (Cloudflare Tunnel or Tailscale) to the Railway-hosted bot. The project structure separates bot handlers (thin) from services (testable business logic), with a format dispatcher pattern for document parsing.

**Major components:**
1. **Bot Handler** -- Receives Telegram messages, routes commands, manages conversation flow. Thin layer that delegates to services.
2. **Parser Service** -- Format dispatcher that routes to PDF/image/DOCX/XLSX parsers. Unified `ExtractedContent` interface.
3. **Claude Service** -- Sends documents/text to Claude API with prompt templates. Handles both direct PDF submission and text-based summarization.
4. **PDF Generator** -- Renders structured summary data into professional executive summary PDFs via PDFKit.
5. **File Router** (Phase 2) -- Abstracts file source: Telegram upload vs. iCloud Drive agent. Strategy pattern.
6. **Local File Agent** (Phase 2) -- Express server on Mac, exposes iCloud Drive search/read over HTTPS tunnel.

### Critical Pitfalls

1. **iCloud Drive has no server-side API** -- Apple provides zero way to access Drive files from Linux/Railway. This is the #1 project risk. Avoid by starting with Telegram-uploaded documents for MVP, then adding a local Mac agent in Phase 2.

2. **Claude API token/cost overruns** -- Each PDF page costs 1,500-3,000 tokens (text + image). A 100-page document can cost $1-3 per request. Avoid by implementing pre-flight token estimation, page limits, and cost logging on every API call. Use Sonnet, not Opus, for routine summarization.

3. **Telegram 20MB download limit** -- Bots can only download files up to 20MB via standard Bot API. Large scanned contracts exceed this. Avoid by checking `file_size` before download, warning user about oversized files, and optionally using Local Bot API server for 2GB limit.

4. **Bot polling loop crashes without recovery** -- grammY/Telegraf can crash on certain Telegram API errors (409 Conflict, network timeouts) and never restart polling. Avoid by using `bot.catch()` for all errors, calling `deleteWebhook()` before polling starts, and adding Railway health checks.

5. **Scanned document OCR produces garbage summaries** -- Traditional OCR (Tesseract) produces ~80% accuracy on degraded scans, leading to confident-sounding summaries with wrong numbers. Avoid by using Claude's native vision/PDF support (2.1% character error rate) instead of separate OCR, and adding confidence flags for scanned documents.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Bot Foundation and Telegram Pipeline
**Rationale:** The bot skeleton, auth guard, and Telegram file reception are prerequisites for everything. No dependencies on iCloud Drive. Delivers immediate value -- user can send documents to the bot and get summaries back.
**Delivers:** Working Telegram bot that receives documents, extracts text, and returns plain-text summaries via Claude API.
**Addresses:** Telegram command interface, PDF text extraction, Claude summarization, confirmation step, error handling, auth guard.
**Avoids:** Bot polling crash (build resilience from day 1), Telegram file size limits (validate sizes on receipt), security mistakes (auth guard, env vars for secrets).

### Phase 2: Document Processing Pipeline
**Rationale:** Depends on Phase 1 bot working. Expands format support and builds the full parsing pipeline. Claude's native PDF/vision support simplifies this significantly.
**Delivers:** Multi-format document support (PDF, images, DOCX, XLSX), Claude Vision for scanned documents, token estimation and cost management.
**Uses:** pdf-parse, mammoth, xlsx, sharp, Claude Vision API.
**Implements:** Format Dispatcher pattern, Claude-as-OCR for images.
**Avoids:** OCR quality issues (use Claude Vision, not Tesseract), token cost overruns (pre-flight estimation, logging).

### Phase 3: PDF Generation and Delivery
**Rationale:** Depends on Phase 2 producing quality summaries. Transforms plain-text summaries into professional, shareable PDFs.
**Delivers:** Executive summary PDF generation via PDFKit, PDF sent back via Telegram, professional template with real estate formatting.
**Uses:** PDFKit, @grammyjs/files for document sending.
**Avoids:** PDF size exceeding Telegram's 50MB upload limit (keep text-heavy, compress images).

### Phase 4: Real Estate Domain Intelligence
**Rationale:** Once the end-to-end pipeline works, optimize the output quality. This is prompt engineering, not infrastructure work.
**Delivers:** Domain-aware summaries that extract key dates, prices, parties, contingencies. Summary caching to avoid re-processing. Custom summary templates.
**Addresses:** Real estate domain-aware prompts, summary caching, custom templates.

### Phase 5: iCloud Drive Integration (Local Agent)
**Rationale:** This is the hardest infrastructure phase and depends on everything else working. Requires a separate process running on the Mac, secure tunnel setup, and file search logic. Defer until the core summarization pipeline is proven.
**Delivers:** Search and retrieve files from iCloud Drive via natural language queries. Local agent on Mac exposes file search API over Cloudflare Tunnel.
**Addresses:** iCloud Drive file browsing, file search by name, save PDF to source folder.
**Avoids:** iCloud file eviction (check file size, use `brctl download`), no-server-API pitfall (runs locally on Mac).

### Phase Ordering Rationale

- **Phase 1 before 2:** You need a working bot before you can process documents through it. The bot skeleton is the delivery mechanism for everything.
- **Phase 2 before 3:** You need quality summaries before you can put them in PDFs. Bad summaries in professional-looking PDFs are worse than good summaries in plain text.
- **Phase 3 before 4:** Get the PDF output working before tuning domain-specific content. Separates formatting concerns from content quality.
- **Phase 4 before 5:** Domain intelligence is prompt engineering (low risk, high value). iCloud integration is infrastructure (high risk, high complexity). Get the easy wins first.
- **Phase 5 last:** The iCloud Drive access problem is the riskiest part of the entire project. By deferring it, the tool is useful (via direct Telegram uploads) even if iCloud integration proves harder than expected.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (iCloud Drive Integration):** The local agent architecture, secure tunnel setup, file eviction handling, and file search indexing all need detailed research. No established pattern exists for this specific use case. This is the highest-risk phase.
- **Phase 2 (Document Processing):** Claude's native PDF handling limits (100 pages, 32MB) and token cost patterns need validation with real real estate documents during implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bot Foundation):** grammY has excellent docs and examples. Telegram bot setup is well-documented. Standard middleware patterns.
- **Phase 3 (PDF Generation):** PDFKit is straightforward. Well-documented API with many examples.
- **Phase 4 (Domain Intelligence):** Prompt engineering only. No infrastructure research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry with current versions. grammY, Anthropic SDK, PDFKit are well-established. |
| Features | MEDIUM | Feature categories are solid but the iCloud Drive features (browsing, search, save-back) assume API access that does not exist. Feature priorities need adjustment. |
| Architecture | HIGH | Pipeline pattern is well-established. Phase 1 (Telegram upload) architecture is straightforward. Phase 2 (local agent) architecture is sound but untested. |
| Pitfalls | HIGH | Verified against official Telegram Bot API docs, Anthropic docs, and Apple iCloud behavior. The iCloud pitfall is the most critical finding of the entire research. |

**Overall confidence:** MEDIUM -- The core pipeline (receive -> parse -> summarize -> PDF -> deliver) is HIGH confidence with well-documented tools. The iCloud Drive integration drops overall confidence to MEDIUM because it fundamentally changes the project scope and timeline.

### Gaps to Address

- **iCloud Drive access strategy needs a firm decision:** The PROJECT.md says "iCloud Drive API" but this does not exist. Must decide between: (a) MVP with Telegram uploads only, (b) run bot locally on Mac, or (c) build local agent + tunnel from the start. Recommendation: option (a) for MVP, option (c) for Phase 5.
- **Real estate document characteristics need validation:** Token costs, page counts, and OCR quality estimates are based on general benchmarks. Need to test with Sammy's actual documents to validate assumptions about file sizes, scan quality, and typical document length.
- **Railway vs. local deployment:** If running locally on Mac for iCloud access, Railway deployment is unnecessary for MVP. If using Telegram uploads only, Railway deployment works but adds hosting complexity for a single-user tool. Consider whether `tsx watch` + `pm2` on the Mac is simpler for v1.
- **Claude model selection:** Research assumes Claude Sonnet for cost-effective summarization but does not validate summary quality vs. Opus for real estate documents specifically. May need to test both.

## Sources

### Primary (HIGH confidence)
- [Telegram Bot API Official Documentation](https://core.telegram.org/bots/api) -- File limits, rate limits, sendDocument
- [Claude API PDF Support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- Native PDF handling, 32MB/100-page limits
- [Claude API Vision](https://platform.claude.com/docs/en/build-with-claude/vision) -- Image processing, OCR capabilities
- [grammY Official Documentation](https://grammy.dev/) -- Framework features, plugin ecosystem, reliability guide
- [grammY Framework Comparison](https://grammy.dev/resources/comparison) -- vs Telegraf and node-telegram-bot-api
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Official SDK
- [rclone iCloud Drive docs](https://rclone.org/iclouddrive/) -- Remote iCloud access limitations, 30-day token expiry
- npm registry (all package versions verified directly)

### Secondary (MEDIUM confidence)
- [iCloud Drive local path behavior](https://eclecticlight.co/2024/03/18/how-icloud-drive-works-in-macos-sonoma/) -- File eviction, ~/Library/Mobile Documents/ path
- [brctl download for evicted files](https://techgarden.alphasmanifesto.com/mac/Manually-downloading-or-evicting-iCloud-files) -- Force-download evicted files
- [Railway deployment guide](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) -- Deployment patterns
- [PDFBolt: Top PDF Generation Libraries](https://pdfbolt.com/blog/top-nodejs-pdf-generation-libraries) -- PDFKit vs Puppeteer
- [pyicloud GitHub](https://github.com/picklepete/pyicloud) -- 2FA limitations, session expiry

### Tertiary (LOW confidence)
- [AI Document Search Patterns](https://www.theaiautomators.com/build-ai-agents-that-explore/) -- Semantic vs structural search (single source)
- [Building a Scalable Telegram Bot](https://medium.com/@pushpesh0/building-a-scalable-telegram-bot-with-node-js-bullmq-and-webhooks-6b0070fcbdfc) -- Scaling patterns (single blog post)

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*
