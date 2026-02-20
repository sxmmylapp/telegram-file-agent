# Feature Research

**Domain:** Telegram-based AI file agent / real estate document assistant
**Researched:** 2026-02-19
**Confidence:** MEDIUM -- Feature categories derive from documented Telegram bot capabilities (HIGH), real estate document workflows (MEDIUM), and iCloud Drive remote access patterns (MEDIUM, pyicloud is third-party and 2FA complicates server use).

## Feature Landscape

### Table Stakes (Users Expect These)

Features the user (Sammy, single-user tool) assumes exist. Missing these = tool is not useful.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Telegram command interface** | Primary interaction point; user sends commands, bot responds. Without this the product literally does not exist. | LOW | Use python-telegram-bot or grammy. Slash commands + inline buttons for confirmations. |
| **iCloud Drive file browsing** | The entire value prop is finding files in a messy iCloud folder structure. Must list and navigate directories remotely. | MEDIUM | pyicloud provides `api.drive` with `.dir()` and folder indexing. Requires Apple ID auth + 2FA session management on server. |
| **File search by name** | User asks "find the Johnson contract" -- bot must locate it across nested folders. Fuzzy/partial matching is essential for messy naming. | MEDIUM | Recursive directory walk + fuzzy string matching (fuzzywuzzy/rapidfuzz). Not semantic search yet -- just filename/path matching. |
| **PDF parsing and text extraction** | Most real estate docs are PDFs. If the bot cannot read PDFs, it cannot summarize anything. | LOW | PyPDF2/pdfplumber for text PDFs. Well-established libraries. |
| **Image OCR** | Scanned contracts, photos of documents, signed disclosures -- common in real estate. Must extract text from images. | MEDIUM | Tesseract OCR or cloud OCR (Google Vision API). Tesseract is free but lower accuracy on messy scans; Google Vision is better but costs per call. |
| **Document summarization via Claude API** | Core AI capability. User sends/finds doc, bot summarizes it. This is the primary value. | LOW | Anthropic Claude API with document content as context. Straightforward prompt engineering. |
| **Executive summary PDF generation** | Output must be a professional PDF, not just chat text. Real estate agents share PDFs with clients/partners. | MEDIUM | ReportLab or WeasyPrint for Python PDF generation. Need a clean template with branding. |
| **Send PDF back in Telegram** | Generated summary PDF must be delivered in-chat. Standard Telegram bot capability. | LOW | `sendDocument` API method. 50MB limit (more than enough for summary PDFs). |
| **Save PDF to source folder** | Summary should live alongside the original documents for future reference. | MEDIUM | pyicloud file upload back to iCloud Drive. Need to handle folder path resolution. |
| **Confirmation step before summarizing** | User wants to verify the right file(s) before burning Claude API tokens. "Found 3 files matching 'Johnson'. Which one?" | LOW | Telegram inline keyboard buttons. Show file list, user taps to confirm. |
| **Error handling and status messages** | User needs to know: is the bot working? Did OCR fail? Is the file too large? | LOW | Progress indicators, error messages, retry prompts. Standard bot UX. |
| **Multi-format document support** | Real estate involves PDFs, Word docs (.docx), spreadsheets (.xlsx), and images. Must handle all common types. | MEDIUM | python-docx for Word, openpyxl for Excel, plus PDF and image handling above. Each format needs its own parser. |

### Differentiators (Competitive Advantage)

Features that make this tool meaningfully better than "just ask ChatGPT." Not required for MVP but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Semantic file search** | Instead of just matching filenames, search by meaning: "find the disclosure for the Oak Street property" matches files even if poorly named. Indexes file content, not just names. | HIGH | Requires indexing iCloud Drive contents into vector embeddings. Would need a vector store (e.g., ChromaDB, Qdrant) and periodic re-indexing. Major lift but massive UX improvement for messy folders. |
| **Multi-document summarization** | Summarize an entire transaction folder at once: "summarize everything in the Johnson deal folder." Combines multiple docs into one coherent executive summary. | MEDIUM | Iterate files in folder, extract text from each, concatenate/chunk for Claude. Main challenge is context window management for large document sets. |
| **Real estate domain-aware summaries** | Summaries that understand real estate concepts: automatically extract key dates, prices, contingencies, parties, property addresses from contracts and disclosures. | MEDIUM | Prompt engineering with real estate-specific extraction templates. Claude handles this well with good prompts. No custom model needed. |
| **Document type classification** | Auto-detect whether a file is a purchase agreement, disclosure, inspection report, title doc, etc. Tag and organize automatically. | MEDIUM | Claude can classify documents from their content. Use structured output to get document type, then apply type-specific summary templates. |
| **Conversation memory** | Bot remembers context within a session: "now summarize the other one" refers to a previously found file. Natural conversation flow. | MEDIUM | Session state management. Store recent search results and conversation context. Redis or in-memory for single user. |
| **Scheduled folder monitoring** | Watch a folder for new files and proactively notify: "New document added to the Johnson deal folder." | MEDIUM | Periodic polling of iCloud Drive folders. Compare file lists, notify on changes. Cron job or background task. |
| **Custom summary templates** | Different summary formats for different audiences: client-facing, internal notes, legal review, quick glance vs. detailed. | LOW | Multiple prompt templates stored in config. User selects via command or inline button. |
| **Batch processing** | "Summarize all new docs this week" or "process everything in my inbox folder." | MEDIUM | Queue-based processing. Iterate folder, filter by date, process sequentially with progress updates in Telegram. |
| **Summary caching** | Don't re-summarize a document that hasn't changed. Save API costs and time. | LOW | Hash file content, store summary with hash. Check hash before re-processing. SQLite or simple JSON store. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create complexity without proportional value for a single-user personal tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-user access control** | "Other agents on my team should use it too." | Massively increases complexity: auth, permissions, billing, data isolation. This is a personal tool. | Keep single-user. If team access is needed later, spin up separate bot instances per user. |
| **Real-time file sync / local cache** | "Keep a local copy of all iCloud files on the server for faster access." | iCloud Drive can be huge. Syncing everything wastes storage, bandwidth, and creates consistency headaches. Server storage on Railway is ephemeral. | Fetch files on-demand. Cache only recently accessed files with TTL. |
| **Document editing / annotation** | "Let me edit the doc from Telegram." | Telegram is a terrible document editor. This fights the medium instead of leveraging it. | Bot is read-only + summary generation. Editing happens in native apps. Provide a link/path to the file for editing. |
| **Full RAG knowledge base** | "Index everything and let me ask any question about any document ever." | Requires maintaining a full vector database of all documents, re-indexing on changes, managing embeddings. Massive infrastructure for a single user. | Start with on-demand summarization. Add semantic search to a single folder as a differentiator if needed, not the entire drive. |
| **Voice message processing** | "Let me send voice messages and the bot transcribes + acts on them." | Adds speech-to-text dependency, increases error rate, harder to parse intent. Telegram text is fine for a power user. | Text commands only. Clear, unambiguous, loggable. |
| **Web dashboard** | "I want a web UI to see all my summaries." | Separate frontend to build, host, and maintain. Duplicates what Telegram already provides (chat history is searchable). | Telegram IS the UI. Chat history serves as the summary archive. Use Telegram's search to find past summaries. |
| **Integration with MLS/CRM systems** | "Pull listing data from MLS, push to my CRM." | Each integration is its own project. MLS APIs are restricted and vary by region. CRM APIs are all different. Scope creep city. | Phase 1 is file-based only. If CRM integration is needed, it's a separate project/milestone. |
| **Auto-classification of all iCloud files** | "Scan my entire drive and organize everything." | Extremely expensive (API costs for reading every file), invasive (moves files around), and risky (what if it misfiles something?). | On-demand classification only. User points bot at a folder, bot classifies what's inside. Never auto-reorganize. |

## Feature Dependencies

```
[Telegram Command Interface]
    |
    +--requires--> [iCloud Drive File Browsing]
    |                  |
    |                  +--requires--> [File Search by Name]
    |                  |
    |                  +--requires--> [Save PDF to Source Folder]
    |
    +--requires--> [PDF Parsing] --enhances--> [Document Summarization]
    |
    +--requires--> [Image OCR] --enhances--> [Document Summarization]
    |
    +--requires--> [Multi-Format Support] --enhances--> [Document Summarization]
    |
    +--requires--> [Document Summarization via Claude]
    |                  |
    |                  +--produces--> [Executive Summary PDF Generation]
    |                                     |
    |                                     +--delivers--> [Send PDF in Telegram]
    |                                     |
    |                                     +--delivers--> [Save PDF to Source Folder]
    |
    +--enhances--> [Confirmation Step]

[File Search by Name] --upgrades-to--> [Semantic File Search]
    (Semantic search requires file search infrastructure first)

[Document Summarization] --enhances--> [Multi-Document Summarization]
    (Multi-doc requires single-doc to work first)

[Document Summarization] --enhances--> [Real Estate Domain-Aware Summaries]
    (Domain awareness is prompt engineering on top of base summarization)

[Document Summarization] --enables--> [Summary Caching]
    (Caching requires summarization pipeline to exist)

[iCloud Drive File Browsing] --enables--> [Scheduled Folder Monitoring]
    (Monitoring requires browse/list capability)
```

### Dependency Notes

- **Telegram Interface requires iCloud Drive Browsing:** Without filesystem access, the bot has nothing to search or summarize. These two are co-dependent for any useful workflow.
- **All parsers (PDF, OCR, DOCX, XLSX) feed into Summarization:** The parsing layer is a prerequisite. Build parsers before the summarization pipeline.
- **PDF Generation requires Summarization:** Can't generate a summary PDF without first having a summary. The generation is the output formatting step.
- **Semantic Search upgrades File Search:** Don't attempt semantic search until basic filename search works. Semantic search is a layer on top, not a replacement.
- **Multi-Document Summarization requires Single-Document:** Get one-doc summarization solid before attempting multi-doc. Context window management for multi-doc is tricky.
- **Summary Caching depends on Summarization Pipeline:** Caching is an optimization. Build the happy path first, then add caching to avoid redundant API calls.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept works end-to-end.

- [ ] **Telegram bot with basic commands** -- `/search <query>`, `/summarize`, `/help`. The conversational entry point.
- [ ] **iCloud Drive authentication and browsing** -- Connect to iCloud, list folders, navigate directory tree. This is the hardest infrastructure piece and must work first.
- [ ] **File search by name (fuzzy)** -- Recursive folder walk with fuzzy string matching. Find files even with typos or partial names.
- [ ] **PDF text extraction** -- Parse standard (non-scanned) PDFs. Covers the majority of real estate documents.
- [ ] **Claude API summarization** -- Send extracted text to Claude, get summary back. Basic prompt, no domain-specific template yet.
- [ ] **Confirmation step** -- Show found files, user confirms which to summarize before API call.
- [ ] **Send summary as Telegram message** -- Plain text summary in chat. No PDF generation yet.
- [ ] **Error handling and logging** -- Structured logging, graceful error messages, never silent failures.

### Add After Validation (v1.x)

Features to add once the core loop (search -> confirm -> summarize -> deliver) is working reliably.

- [ ] **Image OCR** -- Add when scanned docs become a blocker. Tesseract first, upgrade to Google Vision if accuracy is insufficient.
- [ ] **Word doc and spreadsheet parsing** -- Add when these file types are encountered in practice. Low effort per format.
- [ ] **Executive summary PDF generation** -- Replace plain text summaries with professional PDFs. Add when the summary quality is validated.
- [ ] **Save PDF to source folder** -- Upload generated PDF back to iCloud Drive alongside originals.
- [ ] **Real estate domain-aware prompts** -- Tune summary prompts to extract key dates, prices, parties, contingencies. Add once basic summaries prove useful.
- [ ] **Summary caching** -- Hash-based deduplication to avoid re-summarizing unchanged files. Add when API costs become noticeable.
- [ ] **Custom summary templates** -- Multiple output formats (quick glance vs. detailed, client-facing vs. internal). Add based on actual usage patterns.

### Future Consideration (v2+)

Features to defer until the tool is a proven daily driver.

- [ ] **Semantic file search** -- Vector-based content search across documents. Defer because it requires indexing infrastructure and the filename search may be sufficient.
- [ ] **Multi-document summarization** -- Summarize entire transaction folders. Defer because context window management is complex and single-doc may suffice.
- [ ] **Document type classification** -- Auto-detect document types. Defer because manual selection via confirmation step is fine for single user.
- [ ] **Scheduled folder monitoring** -- Proactive notifications for new files. Defer because it's polling infrastructure that's only valuable after daily use is established.
- [ ] **Conversation memory** -- Session context for natural follow-ups. Defer because explicit commands are clearer and less error-prone for v1.
- [ ] **Batch processing** -- Process multiple files in one command. Defer until the single-file flow is rock solid.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Telegram bot interface | HIGH | LOW | P1 |
| iCloud Drive auth + browsing | HIGH | HIGH | P1 |
| File search (fuzzy name match) | HIGH | MEDIUM | P1 |
| PDF text extraction | HIGH | LOW | P1 |
| Claude API summarization | HIGH | LOW | P1 |
| Confirmation step | MEDIUM | LOW | P1 |
| Error handling + logging | MEDIUM | LOW | P1 |
| Send summary in Telegram | HIGH | LOW | P1 |
| Image OCR | MEDIUM | MEDIUM | P2 |
| Word/Excel parsing | MEDIUM | LOW | P2 |
| Executive summary PDF gen | MEDIUM | MEDIUM | P2 |
| Save PDF to iCloud | MEDIUM | MEDIUM | P2 |
| Domain-aware RE prompts | HIGH | LOW | P2 |
| Summary caching | LOW | LOW | P2 |
| Custom summary templates | MEDIUM | LOW | P2 |
| Semantic file search | HIGH | HIGH | P3 |
| Multi-doc summarization | MEDIUM | MEDIUM | P3 |
| Document classification | LOW | MEDIUM | P3 |
| Folder monitoring | LOW | MEDIUM | P3 |
| Conversation memory | LOW | MEDIUM | P3 |
| Batch processing | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the core search-confirm-summarize-deliver loop
- P2: Should have, add iteratively -- improves output quality and format coverage
- P3: Nice to have, future consideration -- advanced features for power usage

## Competitor Feature Analysis

| Feature | summary-gpt-bot (GitHub) | SummarizeBot | n8n RAG Telegram Bot | Our Approach |
|---------|-------------------------|--------------|---------------------|--------------|
| PDF summarization | Yes (basic) | Yes (wide format support) | Yes (with Qdrant vectors) | Yes -- via Claude API for higher quality summaries |
| Image OCR | No | Yes (via their engine) | Yes (Mistral AI OCR) | Yes -- Tesseract or Google Vision |
| File source | User uploads to Telegram | User uploads or cloud links | Google Drive integration | iCloud Drive integration (unique, personal tool) |
| Search capability | None (user provides file) | None (user provides file) | RAG vector search on indexed PDFs | Fuzzy filename search + future semantic search |
| Output format | Text in chat | Text in chat | Text in chat | PDF generation + text in chat |
| Domain specialization | Generic | Generic | Generic | Real estate-specific prompts and extraction |
| Multi-doc summary | No | No | Partial (RAG across docs) | Planned for v2 |
| Access control | ALLOWED_USERS env var | Account-based | Workflow-based | Single user, Telegram user ID check |
| Model flexibility | GPT-3.5/GPT-4 | Proprietary | Gemini + Mistral | Claude (Anthropic) -- chosen for long context and document understanding |
| Self-hosted | Yes (Docker) | No (SaaS) | Yes (n8n self-host) | Yes (Railway) |

**Our key differentiators vs. existing solutions:**
1. **iCloud Drive native integration** -- No existing Telegram bot searches iCloud Drive. This is the unique value.
2. **Real estate domain awareness** -- Generic summarizers don't extract key dates, prices, contingencies. Ours will.
3. **Professional PDF output** -- Most bots output text. We generate shareable executive summary PDFs.
4. **File saved back to source** -- Summary lives alongside originals. No existing bot does this.

## Sources

- [Telegram Bot API - Official Documentation](https://core.telegram.org/bots/api) -- File handling capabilities, sendDocument method, size limits (HIGH confidence)
- [Telegram Bot Features - Official](https://core.telegram.org/bots/features) -- Bot capabilities and interaction patterns (HIGH confidence)
- [summary-gpt-bot - GitHub](https://github.com/tpai/summary-gpt-bot) -- Competitor analysis, feature set of existing Telegram summarization bot (HIGH confidence)
- [pyicloud - GitHub/PyPI](https://github.com/picklepete/pyicloud) -- iCloud Drive API access patterns, capabilities and limitations (MEDIUM confidence, third-party library)
- [SummarizeBot FAQ](https://www.summarizebot.com/faq.html) -- Supported document formats, capabilities (MEDIUM confidence)
- [Real Estate Document Processing Tools - Extend.ai](https://www.extend.ai/resources/real-estate-document-processing-platforms) -- Real estate document processing landscape (MEDIUM confidence)
- [n8n Telegram RAG Bot Template](https://n8n.io/workflows/4525-build-a-multi-functional-telegram-bot-with-gemini-rag-pdf-search-and-google-suite/) -- RAG-based document search pattern (MEDIUM confidence)
- [Telegram File Size Limits - Medium](https://medium.com/@khudoyshukur/how-to-bypass-telegram-bot-50-mb-file-limit-3a4d9b1788ae) -- 50MB bot API limit workarounds (MEDIUM confidence)
- [Real Estate Document Types - Paperless Pipeline](https://www.paperlesspipeline.com/blog/real-estate-forms-101-everything-brokers-teams-and-tcs-need-to-know) -- Common document types in real estate transactions (MEDIUM confidence)
- [AI Document Search Patterns - The AI Automators](https://www.theaiautomators.com/build-ai-agents-that-explore/) -- Semantic vs. structural search strategies (LOW confidence, single source)

---
*Feature research for: Telegram-based AI file agent / real estate document assistant*
*Researched: 2026-02-19*
