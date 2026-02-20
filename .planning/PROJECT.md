# Telegram File Agent

## What This Is

A Telegram bot that acts as an AI-powered file agent for a real estate professional. You chat with it naturally ("summarize the Oak Ave listing"), and it searches your iCloud Drive to find relevant documents, reads and understands them, generates an executive summary PDF, saves it to the source folder, and sends it back in Telegram. Hosted on Railway, designed to support additional workflows over time.

## Core Value

The agent finds, reads, and summarizes your scattered real estate documents on demand — so you never have to dig through folders or manually compile summaries.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Conversational Telegram interface for triggering file workflows
- [ ] Intelligent file search across iCloud Drive (messy/unstructured folders)
- [ ] Multi-format document parsing (PDF, images/scans, spreadsheets, Word docs)
- [ ] Document summarization via Claude API (executive summary style)
- [ ] PDF generation from summary output
- [ ] PDF saved to source folder AND sent in Telegram chat
- [ ] Configurable confirmation step (bot shows found files before summarizing)
- [ ] Hosted on Railway with persistent bot process
- [ ] Extensible architecture for future workflows and file access methods

### Out of Scope

- Local agent (file access via process on Mac) — deferred to future milestone, iCloud API first
- Multiple summary templates — v1 is executive summary only, architecture supports adding more later
- Multi-user support — this is a personal tool for one user
- Voice messages — text-only interaction for v1
- File editing/writing — read-only for v1, agent only reads and summarizes

## Context

- User is a real estate agent working with property listings, disclosures, contracts, comps, financials, property photos, and scanned documents
- Files are spread across iCloud Drive with no consistent folder structure — the agent must search intelligently
- File types: PDF, images (property photos, scanned docs), Excel/CSV spreadsheets, Word/text documents
- Future vision: this becomes a general-purpose Telegram agent with multiple workflows (summarization is just the first)
- iCloud Drive API provides cloud file access; local agent on Mac planned for future workflows
- Claude API (Anthropic) for both natural language understanding and document summarization
- Telegram Bot API for the conversational interface
- Railway for hosting

## Constraints

- **File Access**: iCloud Drive API only for v1 — no local filesystem access
- **LLM**: Claude API (Anthropic) — user preference
- **Hosting**: Railway — must run as a persistent process
- **Telegram Bot**: Must use Telegram Bot API (user already has bot setup skills available)
- **Image Processing**: Needs OCR capability for scanned documents and property photos with text

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| iCloud Drive API for file access | Files already synced there; avoids running local agent for v1 | — Pending |
| Claude API for LLM | User preference; strong at document analysis | — Pending |
| Railway for hosting | User preference; has CLI access and setup skills | — Pending |
| Confirmation step is configurable | Sometimes want to verify found files, sometimes just go fast | — Pending |
| PDF output to both source folder and Telegram | Keeps files organized AND provides immediate access | — Pending |
| Extensible workflow architecture | More workflows coming; file access layer should be pluggable | — Pending |

---
*Last updated: 2026-02-19 after initialization*
