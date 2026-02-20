# Roadmap: Telegram File Agent

## Overview

This roadmap delivers a Telegram bot that receives real estate documents, summarizes them via Claude API, and returns professional PDF summaries. The journey starts with a working bot that can receive and validate documents (Phase 1), adds AI-powered summarization for PDFs and images using Claude's native capabilities (Phase 2), generates professional PDF output delivered via Telegram (Phase 3), and finishes by expanding format support and adding real estate domain intelligence (Phase 4). Each phase delivers a complete, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bot Foundation & Document Reception** - Working Telegram bot that receives documents, validates them, and confirms receipt
- [x] **Phase 2: Core Summarization Pipeline** - PDF and image documents summarized via Claude with cost tracking (completed 2026-02-20)
- [ ] **Phase 3: PDF Output & Delivery** - Professional executive summary PDFs generated and sent via Telegram
- [ ] **Phase 4: Extended Formats & Domain Intelligence** - Word/spreadsheet support and real estate-specific data extraction

## Phase Details

### Phase 1: Bot Foundation & Document Reception
**Goal**: User can send documents to the Telegram bot and receive confirmation of what was received
**Depends on**: Nothing (first phase)
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, INP-01, INP-02, INP-03
**Success Criteria** (what must be TRUE):
  1. User can message the bot in Telegram and receive conversational responses
  2. Only the authorized Telegram user (Sammy) can interact with the bot; unauthorized users are rejected
  3. User can send a PDF or image file to the bot and the bot acknowledges receipt with file details (name, size, type)
  4. Bot warns the user when a file exceeds Telegram's 20MB download limit before attempting to process it
  5. All bot operations produce structured logs (timestamps, function names, request IDs) and errors show user-friendly messages while logging full stack traces
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md — Project scaffolding, dependencies, config, logger, and types
- [ ] 01-02-PLAN.md — Auth middleware, command handlers, document handlers, bot wiring

### Phase 2: Core Summarization Pipeline
**Goal**: User can send a PDF or image to the bot and receive a plain-text executive summary back in the chat
**Depends on**: Phase 1
**Requirements**: PROC-01, PROC-02, SUMM-01, SUMM-02, SUMM-04
**Success Criteria** (what must be TRUE):
  1. User sends a PDF document and receives an executive summary (key details, highlights, concerns) as a Telegram message
  2. User sends a scanned document or image and receives a summary extracted via Claude Vision
  3. Summaries follow executive summary format: 1-2 pages worth of content covering key details, highlights, and concerns
  4. Bot logs estimated token count and cost before each Claude API call
**Plans**: TBD

### Phase 3: PDF Output & Delivery
**Goal**: User receives a professionally formatted executive summary PDF back in the Telegram chat
**Depends on**: Phase 2
**Requirements**: OUT-01, OUT-02
**Success Criteria** (what must be TRUE):
  1. After summarization, bot generates a professional-looking PDF with the executive summary content
  2. Bot sends the generated PDF file back to the user in the Telegram chat as a document attachment
**Plans:** 2 plans
Plans:
- [ ] 03-01-PLAN.md — PDF generation service with PDFKit (markdown-to-PDF renderer)
- [ ] 03-02-PLAN.md — Wire PDF generation into document handlers, send via Telegram

### Phase 4: Extended Formats & Domain Intelligence
**Goal**: User can summarize Word docs and spreadsheets, and all summaries extract real estate-specific data
**Depends on**: Phase 3
**Requirements**: PROC-03, PROC-04, SUMM-03
**Success Criteria** (what must be TRUE):
  1. User sends a Word document (.docx) and receives a summary
  2. User sends a spreadsheet (.xlsx or .csv) and receives a summary
  3. All summaries extract and highlight real estate-specific data: key dates, prices, parties involved, contingencies, and property details
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bot Foundation & Document Reception | 0/2 | Planned | - |
| 2. Core Summarization Pipeline | 0/? | Complete    | 2026-02-20 |
| 3. PDF Output & Delivery | 1/2 | In Progress | - |
| 4. Extended Formats & Domain Intelligence | 0/? | Not started | - |
