# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** The agent finds, reads, and summarizes your scattered real estate documents on demand -- so you never have to dig through folders or manually compile summaries.
**Current focus:** Phase 3: PDF Output & Delivery

## Current Position

Phase: 3 of 4 (PDF Output & Delivery)
Plan: 1 of 2 in current phase
Status: In Progress
Last activity: 2026-02-20 -- Completed 03-01 PDF generation service

Progress: [######....] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 2 min
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-bot-foundation | 2 | 5 min | 2.5 min |
| 02-summarization-pipeline | 2 | 3 min | 1.5 min |
| 03-pdf-output-delivery | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 01-02 (2 min), 02-01 (2 min), 02-02 (1 min), 03-01 (2 min)
- Trend: Stable/Improving

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

### Pending Todos

None yet.

### Blockers/Concerns

- Claude API cost management needed -- large documents (100 pages) can cost $1-3 per request
- Telegram 20MB download limit may block some large scanned contracts

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 03-01-PLAN.md (PDF generation service)
Resume file: None
