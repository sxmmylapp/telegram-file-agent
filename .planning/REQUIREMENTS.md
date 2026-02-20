# Requirements: Telegram File Agent

**Defined:** 2026-02-19
**Core Value:** The agent finds, reads, and summarizes your scattered real estate documents on demand -- so you never have to dig through folders or manually compile summaries.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Bot Interface

- [ ] **BOT-01**: User can interact with bot via conversational Telegram commands
- [ ] **BOT-02**: Bot restricts access to authorized Telegram user ID only
- [ ] **BOT-03**: Bot logs all operations with structured logging (DEBUG/INFO/WARN/ERROR with timestamps, function names, request IDs)
- [ ] **BOT-04**: Bot handles errors gracefully with user-friendly messages and full stack traces in logs

### Document Input

- [ ] **INP-01**: User can send documents directly to bot via Telegram chat
- [ ] **INP-02**: Bot validates file size against Telegram 20MB download limit and warns on oversized files
- [ ] **INP-03**: Bot shows received document details and confirms before processing

### Document Processing

- [ ] **PROC-01**: Bot parses PDF documents via Claude's native PDF support (up to 32MB, 100 pages)
- [ ] **PROC-02**: Bot reads scanned documents and images via Claude Vision (no separate OCR needed)
- [ ] **PROC-03**: Bot parses Word documents (.docx) via mammoth
- [ ] **PROC-04**: Bot parses spreadsheets (.xlsx/.csv) via SheetJS

### Summarization

- [ ] **SUMM-01**: Bot summarizes document content using Claude API
- [ ] **SUMM-02**: Summary follows executive summary format (1-2 pages: key details, highlights, concerns)
- [ ] **SUMM-03**: Summary extracts real estate-specific data (dates, prices, parties, contingencies, property details)
- [ ] **SUMM-04**: Bot estimates token count and logs cost before each API call

### Output & Delivery

- [ ] **OUT-01**: Bot generates professional executive summary PDF via PDFKit
- [x] **OUT-02**: Bot sends generated PDF back to user in Telegram chat

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Templates & Caching

- **TMPL-01**: User can choose from multiple summary templates (client-facing, internal, quick glance, detailed)
- **TMPL-02**: Bot caches summaries by file hash to avoid re-processing unchanged documents

### Multi-Document

- **MDOC-01**: User can summarize an entire transaction folder in one request
- **MDOC-02**: Bot combines multiple documents into a single coherent executive summary

### iCloud Drive Integration

- **ICLD-01**: Bot searches iCloud Drive files via local Mac agent connected through secure tunnel
- **ICLD-02**: Bot saves generated PDF to the source document folder in iCloud Drive
- **ICLD-03**: User can trigger file search via natural language ("find the Oak Ave listing")

### Session & UX

- **SESS-01**: Bot remembers conversation context within a session for natural follow-ups
- **SESS-02**: User can toggle confirmation step on/off per request

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user access | Personal tool for one user; team access adds auth, permissions, billing complexity |
| Real-time file sync / local cache | iCloud can be huge; fetch on-demand instead |
| Document editing / annotation | Telegram is a terrible editor; bot is read-only |
| Full RAG knowledge base | Massive infrastructure for a single user; on-demand summarization is sufficient |
| Voice message processing | Text commands are clearer, more reliable, loggable |
| Web dashboard | Telegram IS the UI; chat history is searchable |
| MLS/CRM integrations | Each integration is its own project; file-based only for v1 |
| Auto-classification of all files | Expensive, invasive, risky; on-demand only |
| Mobile app | Telegram is the mobile interface |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOT-01 | Phase 1 | Pending |
| BOT-02 | Phase 1 | Pending |
| BOT-03 | Phase 1 | Pending |
| BOT-04 | Phase 1 | Pending |
| INP-01 | Phase 1 | Pending |
| INP-02 | Phase 1 | Pending |
| INP-03 | Phase 1 | Pending |
| PROC-01 | Phase 2 | Pending |
| PROC-02 | Phase 2 | Pending |
| PROC-03 | Phase 4 | Pending |
| PROC-04 | Phase 4 | Pending |
| SUMM-01 | Phase 2 | Pending |
| SUMM-02 | Phase 2 | Pending |
| SUMM-03 | Phase 4 | Pending |
| SUMM-04 | Phase 2 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*
