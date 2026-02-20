---
phase: 02-core-summarization-pipeline
plan: 01
subsystem: api
tags: [anthropic-sdk, claude-api, telegram-file-download, message-splitting, token-counting]

# Dependency graph
requires:
  - phase: 01-02
    provides: "Bot framework with BotContext type, config module with requireEnv pattern, pino logging"
provides:
  - "Claude API wrapper with estimateTokens() and summarizeDocument() using config.CLAUDE_MODEL"
  - "Telegram file download to Buffer via grammY files plugin"
  - "Message splitting utility for 4096-char Telegram limit"
  - "ANTHROPIC_API_KEY and CLAUDE_MODEL config values"
affects: [02-02-document-handlers, 03-search-summarize, 04-deploy]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.78.0"]
  patterns: [service-layer-separation, singleton-api-client, content-blocks-typing, smart-text-splitting]

key-files:
  created:
    - src/services/claude.ts
    - src/services/file-download.ts
    - src/services/message-splitter.ts
  modified:
    - src/config.ts
    - .env.example

key-decisions:
  - "Singleton Anthropic client initialized at module level for reuse across requests"
  - "ContentBlocks type alias extracted from Anthropic SDK types for cleaner function signatures"
  - "Cost estimation uses Sonnet 4.6 pricing ($3/$15 per MTok) with MAX_OUTPUT_TOKENS as worst-case output"
  - "Message splitter rejects splits below half the limit to avoid tiny first chunks"

patterns-established:
  - "Service layer pattern: API logic in src/services/, handlers stay thin"
  - "Token estimation before API call: always log cost before making the request"
  - "Smart text splitting: paragraph boundary -> line boundary -> hard cut fallback"

requirements-completed: [PROC-01, PROC-02, SUMM-01, SUMM-02, SUMM-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 02 Plan 01: Service Layer Summary

**Claude API wrapper with token estimation and cost logging, Telegram file download to Buffer, and smart message splitting for 4096-char limit**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T03:03:58Z
- **Completed:** 2026-02-20T03:05:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Claude service with estimateTokens() for pre-call cost logging and summarizeDocument() for executive summaries
- Token counting uses free countTokens() API endpoint; cost estimation logs input tokens and estimated USD before each call
- File download service converts Telegram file to Buffer using grammY files plugin getFile/getUrl and native fetch
- Message splitter handles Telegram 4096-char limit with intelligent paragraph/line boundary splitting
- Config updated with ANTHROPIC_API_KEY (required, fails fast on missing) and CLAUDE_MODEL (defaults to claude-sonnet-4-6)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Anthropic SDK and update config** - `d914617` (feat)
2. **Task 2: Create Claude service, file download service, and message splitter** - `7626d63` (feat)

## Files Created/Modified
- `src/services/claude.ts` - Claude API wrapper: estimateTokens() for cost logging, summarizeDocument() for executive summaries
- `src/services/file-download.ts` - Downloads Telegram file to Buffer via getFile/fetch pipeline
- `src/services/message-splitter.ts` - Splits long text into 4096-char chunks at paragraph/line boundaries
- `src/config.ts` - Added ANTHROPIC_API_KEY (required) and CLAUDE_MODEL (optional with default)
- `.env.example` - Added ANTHROPIC_API_KEY and CLAUDE_MODEL variables
- `package.json` - Added @anthropic-ai/sdk ^0.78.0 dependency

## Decisions Made
- Singleton Anthropic client initialized at module level for connection reuse across requests
- Extracted ContentBlocks type alias from SDK for cleaner function signatures
- Cost estimation uses worst-case MAX_OUTPUT_TOKENS (4096) for output cost calculation
- System prompt structured as real estate analyst with Key Details, Highlights, and Concerns sections
- Message splitter rejects split points below half the limit to avoid tiny first chunks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

ANTHROPIC_API_KEY must be set before the bot can process documents. The key can be obtained from https://console.anthropic.com/settings/keys or from ~/templates/.env.master.

## Next Phase Readiness
- All three service modules compile and export correct functions
- Ready for plan 02-02 to wire these services into document handlers
- Claude service uses config.CLAUDE_MODEL so model can be changed via env var without code changes

## Self-Check: PASSED

All 5 created/modified files verified present. Both task commits (d914617, 7626d63) confirmed in git log.

---
*Phase: 02-core-summarization-pipeline*
*Completed: 2026-02-20*
