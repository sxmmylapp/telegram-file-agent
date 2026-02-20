# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** The agent finds, reads, and summarizes your scattered real estate documents on demand -- so you never have to dig through folders or manually compile summaries.
**Current focus:** Phase 4: Extended Formats & Domain Intelligence

## Current Position

Phase: 4 of 4 (Extended Formats & Domain Intelligence)
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase Complete
Last activity: 2026-02-20 -- Completed 04-02 document handler wiring for DOCX/XLSX/CSV

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 2 min
- Total execution time: 0.27 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-bot-foundation | 2 | 5 min | 2.5 min |
| 02-summarization-pipeline | 2 | 3 min | 1.5 min |
| 03-pdf-output-delivery | 2 | 4 min | 2 min |
| 04-extended-formats-domain-intelligence | 2 | 4 min | 2 min |

**Recent Trend:**
- Last 5 plans: 03-01 (2 min), 03-02 (2 min), 04-01 (2 min), 04-02 (2 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- iCloud Drive has no server-side API -- v1 uses Telegram-uploaded documents only (iCloud deferred to v2)
- Claude API natively handles PDFs (32MB, 100 pages) and images -- no separate OCR or PDF parsing needed for summarization
- grammY chosen as Telegram framework (TypeScript-first, modern middleware API)
- ESM (type: module) for modern Node.js compatibility with grammy
- AUTHORIZED_USER_IDS as comma-separated numbers supporting multiple users
- Pino with pino-pretty in dev, raw JSON in production
- esbuild bundles everything (no externals) for clean Railway deploys
- Middleware order: logging -> auth -> commands -> documents (logging first to capture all updates)
- GrammyError/HttpError discrimination in bot.catch for targeted error logging
- User-friendly error replies wrapped in .catch(() => {}) to prevent double-error cascades
- Singleton Anthropic client initialized at module level for connection reuse
- Cost estimation uses worst-case MAX_OUTPUT_TOKENS for output cost calculation
- Service layer pattern: API logic in src/services/, handlers stay thin
- Telegram photos always use image/jpeg media type (Telegram compresses all uploads to JPEG)
- Thin handler pattern: handlers build content blocks and delegate to services
- Helvetica built-in fonts only for PDF generation (no external font files)
- Buffer-based PDF generation (no filesystem writes)
- Regex-based inline formatting parser for bold/italic font switching in PDFs
- PDF generation after text summary for immediate user feedback; nested try/catch isolates PDF failures
- Photo PDFs use timestamp filenames; document PDFs use source filename
- Optional feature delivery pattern: core content first, bonus output with isolated error handling
- mammoth convertToHtml preserves table structure (not extractRawText) -- critical for real estate docs
- SheetJS from CDN URL to avoid CVE-2023-30533 in npm registry
- 100KB warning threshold for extracted spreadsheet text (token cost flag)
- Real Estate Data section in Claude prompt for structured property/transaction/contingency extraction
- CSV detection uses MIME type set + .csv extension fallback for Telegram MIME inconsistency
- base64 encoding scoped to PDF/image branches only; text extraction branches skip encoding
- Format-specific content block construction: each format builds own blocks, shared pipeline handles summarization

### Pending Todos

None yet.

### Blockers/Concerns

- Claude API cost management needed -- large documents (100 pages) can cost $1-3 per request
- Telegram 20MB download limit may block some large scanned contracts

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 04-02-PLAN.md (document handler wiring for DOCX/XLSX/CSV) -- Phase 04 complete
Resume file: None
