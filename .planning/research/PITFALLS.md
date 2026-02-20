# Pitfalls Research

**Domain:** Telegram bot + iCloud Drive + AI document processing + PDF generation
**Researched:** 2026-02-19
**Confidence:** HIGH (verified against official docs and multiple sources)

## Critical Pitfalls

### Pitfall 1: iCloud Drive File Eviction Breaks Server-Side File Access

**What goes wrong:**
iCloud Drive "optimizes" local storage by evicting files -- replacing them with 0-byte placeholder stubs. When the bot tries to read a file from `~/Library/Mobile Documents/com~apple~CloudDocs/`, it gets an empty placeholder instead of actual content. The bot silently processes nothing, or crashes on an empty buffer. This is invisible until runtime because the file *appears* to exist in directory listings.

**Why it happens:**
macOS iCloud Drive is designed for interactive desktop use, not server automation. When "Optimize Mac Storage" is enabled, macOS evicts infrequently accessed files to free disk space. The eviction is transparent to Finder (which triggers a download on open) but opaque to command-line tools and Node.js `fs.readFile()`. Files in messy folder structures that haven't been accessed recently are the first to be evicted.

**How to avoid:**
- Disable "Optimize Mac Storage" in System Settings > Apple ID > iCloud > iCloud Drive if running on a Mac host. This forces all files to remain downloaded.
- Before reading any file, check if it's a placeholder by examining the file size (0 bytes = evicted) or checking the `com.apple.ubiquity.plist` extended attribute.
- Use `brctl download <path>` to force-download an evicted file before processing. This command triggers iCloud to materialize the file locally.
- Build a file access layer that wraps all reads with an eviction check + download trigger, with a timeout for the download to complete.
- Consider whether Railway (Linux) can access iCloud at all -- this is actually the bigger problem (see Pitfall 2).

**Warning signs:**
- Files read as empty buffers or 0-byte content
- Inconsistent behavior: files that worked yesterday fail today
- Bot processes run successfully but produce empty summaries
- File counts in directory listings don't match expected content

**Phase to address:**
Phase 1 (Foundation) -- iCloud Drive access strategy must be resolved before any file processing logic is built. This is an architectural decision, not a feature.

---

### Pitfall 2: iCloud Drive Has No Server-Side API for Linux/Railway

**What goes wrong:**
The project assumes it can access iCloud Drive files from Railway (Linux container). Apple provides **zero** official API for server-side iCloud Drive access. The path `~/Library/Mobile Documents/com~apple~CloudDocs/` only exists on macOS. There is no REST API, no SDK, no OAuth flow for third-party server apps to browse and read iCloud Drive files. The project cannot work as described if it runs on Railway and needs to search iCloud Drive.

**Why it happens:**
Apple deliberately locks iCloud Drive to its ecosystem. The only official integrations are: (1) native macOS/iOS apps via CloudKit, (2) the iCloud.com web interface (which requires browser-based Apple ID authentication with 2FA), and (3) third-party wrappers like `pyicloud` which reverse-engineer the iCloud web API and break frequently. Apple's 2FA requirement means headless authentication expires every ~2 months and requires interactive re-authentication with a trusted device.

**How to avoid:**
Choose one of these alternative architectures (in order of recommendation):

1. **Don't use iCloud Drive directly.** Sync the relevant iCloud Drive folders to a cloud storage service that has an API (Google Drive, Dropbox, or an S3 bucket). Use `rclone` on a Mac to mirror iCloud Drive to S3/GCS, then have the Railway bot read from S3/GCS. This is the most reliable approach.

2. **Run the bot on a Mac Mini/Mac Studio** instead of Railway. The bot accesses iCloud Drive locally via the filesystem path. Downside: requires dedicated macOS hardware and can't use Railway's deployment convenience.

3. **Use a companion sync agent on macOS** that watches iCloud Drive folders and uploads files to a staging area (S3, Supabase Storage, etc.) that the Railway bot can access. The sync agent runs on a Mac that's always on; the bot runs on Railway.

4. **Have the user send files directly via Telegram.** Instead of searching iCloud Drive, the user sends documents to the bot in the Telegram chat. The bot downloads them via Telegram's file API. This eliminates iCloud entirely but changes the UX (user must find and send files manually).

5. **Use `pyicloud` (Python) as a microservice** with session persistence. This is fragile: Apple changes their internal API without notice, 2FA sessions expire, and the library has a history of breaking. Not recommended for production.

**Warning signs:**
- Attempting to `fs.readFile()` on paths that don't exist in a Linux container
- Looking for iCloud-related npm packages and finding nothing maintained
- Authentication flows that require interactive 2FA every 2 months

**Phase to address:**
Phase 0 (Architecture Decision) -- This must be resolved before writing any code. The entire file access pattern depends on this choice. This is the single most critical architectural decision in the project.

---

### Pitfall 3: Sending Claude API Requests That Exceed Token/Size Limits

**What goes wrong:**
A real estate agent's document collection includes large contracts, appraisals, and multi-page reports. Developers send an entire 80-page PDF (or multiple documents) to Claude in a single API call without checking limits. The request fails with a 400 error, or worse, succeeds but costs $5+ per request because each PDF page generates 1,500-3,000 text tokens PLUS image tokens for visual analysis. Processing 10 documents in a single request can easily blow past the 200K context window.

**Why it happens:**
Claude's PDF support converts each page to both text AND an image. A 50-page document consumes roughly 75,000-150,000 text tokens plus significant image tokens. Developers think "Claude can handle PDFs" and don't account for the per-page dual processing cost. The 32MB and 100-page hard limits per request are not obviously documented in error messages.

**How to avoid:**
- Implement a pre-flight check before every Claude API call: count pages, estimate tokens (budget ~3,000 tokens/page for text + image), and reject or chunk requests that would exceed limits.
- For multi-document summarization, process each document individually first (extract key points), then do a final synthesis pass with the extracted summaries -- not the raw documents.
- Use Claude's prompt caching (`cache_control: { type: "ephemeral" }`) when asking multiple questions about the same document to avoid re-processing.
- Set `max_tokens` on responses to prevent runaway output costs.
- Log token usage (`input_tokens`, `output_tokens` from the response) for every API call to track costs.

**Warning signs:**
- API calls returning 400 errors with payload size messages
- Monthly Anthropic bills that are 10x expected
- Slow response times (>30 seconds) for document processing
- Context window overflow errors

**Phase to address:**
Phase 2 (Document Processing) -- Build token estimation and document chunking before integrating with Claude API. Never send raw large documents without pre-processing.

---

### Pitfall 4: Telegram Bot File Size Limits Block Document Delivery

**What goes wrong:**
The bot generates a comprehensive executive summary PDF with embedded charts, images, or extensive formatting. The resulting file exceeds 50MB (Telegram's bot upload limit) and the `sendDocument` call fails silently or with a cryptic error. The user sees nothing. Even downloading files FROM the user has a 20MB limit via the standard Bot API (users can send large files, but the bot can only download up to 20MB via `getFile`).

**Why it happens:**
Telegram's standard Bot API has asymmetric file limits: users can upload files up to 2GB to chats, but bots can only download files up to 20MB via `getFile` and send files up to 50MB via `sendDocument`. These limits are documented but easily overlooked. Real estate documents (high-resolution scans, multi-page contracts) frequently exceed 20MB.

**How to avoid:**
- For **downloads** (user sends bot a file): Check `file_size` from the message metadata before calling `getFile`. If >20MB, either (a) use a Local Bot API server (raises limit to 2GB but requires self-hosting the Bot API server alongside your bot), or (b) ask the user to send a compressed version, or (c) use an alternative transfer method (shared cloud link).
- For **uploads** (bot sends user a file): Estimate PDF output size before generation. Keep generated PDFs text-heavy and image-light. Compress images before embedding. If the PDF might exceed 50MB, split into multiple files or upload to cloud storage and send a link instead.
- Log file sizes at every stage: download, processing, and upload.
- Build file size validation into the pipeline as a gate, not an afterthought.

**Warning signs:**
- `sendDocument` calls failing with HTTP 413 or Telegram error codes
- Users sending large files that the bot ignores or fails on
- Generated PDFs with embedded images growing unexpectedly large

**Phase to address:**
Phase 1 (Telegram Bot Foundation) -- File size handling must be built into the bot's core file transfer logic from day one.

---

### Pitfall 5: Bot Polling Loop Crashes and Never Recovers

**What goes wrong:**
The Telegram bot uses long polling (appropriate for Railway), encounters a transient network error or a 409 Conflict error (caused by another instance polling), and the polling loop crashes. The bot process exits or hangs in a broken state. On Railway, the process may or may not restart depending on configuration. The user sends messages and gets no response, with no indication that the bot is down.

**Why it happens:**
Both grammY and Telegraf have documented issues where certain Telegram API errors (401, 409, network timeouts) propagate as unhandled exceptions that kill the polling loop. The default error handlers in these frameworks log the error but don't always restart polling. In containerized environments like Railway, a crashed Node.js process may restart via the container orchestrator, but the delay leaves a window of unresponsiveness. Multiple deployments or restarts can cause 409 Conflict errors when two instances briefly poll simultaneously.

**How to avoid:**
- Use grammY's `bot.catch()` handler to catch ALL errors, log them, and ensure polling continues. Never let errors propagate to unhandled rejection.
- Implement a health check endpoint that Railway can monitor. If the bot stops responding to health checks, Railway restarts the container.
- On startup, explicitly call `deleteWebhook()` before starting polling to clear any stale webhook configuration.
- Use process-level signal handlers for SIGTERM and SIGINT to call `bot.stop()` gracefully.
- Add a watchdog: if no updates have been processed in N minutes (configurable), log a warning and restart the polling loop.
- For Railway: configure restart policy and health checks in `railway.toml` or Procfile.
- Never run multiple instances of the same bot token -- Railway's single-instance deployment is correct for this.

**Warning signs:**
- Bot stops responding but the Railway dashboard shows the service as "running"
- Logs show 409 Conflict errors at startup
- Unhandled promise rejection warnings in logs
- Bot works for hours/days then silently stops

**Phase to address:**
Phase 1 (Telegram Bot Foundation) -- Error handling and resilience must be built into the bot's core loop, not bolted on later.

---

### Pitfall 6: OCR/Document Parsing Produces Garbage for Scanned Real Estate Documents

**What goes wrong:**
Real estate documents are often scanned paper (not digital PDFs), photographed contracts, faxed documents, or multi-column formatted reports. Standard PDF text extraction returns empty strings or garbled text. Tesseract OCR produces ~80% accuracy on degraded scans, resulting in AI summaries that misstate property values, dates, or legal terms. The bot produces a confident-sounding summary with wrong numbers.

**Why it happens:**
Developers test with clean digital PDFs and assume all PDFs will work the same. Real estate document quality varies wildly: faxed copies, phone photos of paper documents, documents with stamps/signatures overlaying text, multi-column layouts, and documents in non-standard fonts. Traditional OCR (Tesseract) struggles with all of these. Even Claude's vision can misread numbers in low-quality scans.

**How to avoid:**
- Use Claude's native PDF support (vision mode) instead of pre-extracting text with OCR libraries. Claude processes each page as both text and image, achieving ~2.1% character error rate on printed text -- far better than Tesseract's ~20% on degraded documents. This eliminates the need for a separate OCR pipeline entirely.
- For images sent directly (photos of documents), send them as image content blocks to Claude's vision API rather than running them through Tesseract first.
- Add confidence indicators to summaries: if the source document was an image/scan (detected by checking if text extraction yields minimal text), flag the summary as "based on scanned document -- verify key figures."
- For critical numerical data (property values, dates, legal terms), implement a verification prompt that asks Claude to double-check extracted numbers against the visual content.
- Never silently produce a summary from a failed OCR -- detect extraction quality and alert the user.

**Warning signs:**
- Text extraction returning very short strings from multi-page documents
- Extracted text full of non-word character sequences
- AI summaries containing obviously wrong numbers or garbled proper nouns
- Users reporting inaccurate summaries

**Phase to address:**
Phase 2 (Document Processing) -- Document type detection and quality assessment must precede summarization. Build a quality gate that checks extraction results before sending to Claude.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding iCloud Drive paths | Quick file access | Breaks on any path change, different user, or non-macOS host | Never -- use config for all paths |
| Skipping token estimation before Claude calls | Faster development | Unpredictable costs, failed requests on large documents | Never -- always estimate before calling |
| Using `getFile` without size checks | Simpler download code | Silent failures on files >20MB, user confusion | Only in prototype phase |
| Storing bot token in source code | Quick setup | Token exposed in git history, security breach | Never -- always use env vars |
| No prompt caching for repeated document analysis | Simpler API calls | 10x higher costs when asking multiple questions about same doc | Only for single-question workflows |
| Generating PDFs with embedded high-res images | Better looking output | File size explodes, exceeds Telegram's 50MB limit | Never -- always compress images first |
| Processing all documents sequentially | Simpler control flow | Slow response times when handling 5+ documents | Only in MVP if latency is acceptable |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram Bot API | Not acknowledging webhook/callback queries before doing work | Acknowledge immediately (HTTP 200 or `answerCallbackQuery`), then process asynchronously. Failure to ack causes Telegram to retry, creating duplicate processing. |
| Telegram Bot API | Using `getFile` URL without the bot token prefix | The file download URL is `https://api.telegram.org/file/bot<token>/<file_path>`. Missing the `bot` prefix or token causes 404. |
| Telegram Bot API | Not handling the 30 msg/sec rate limit | Implement a message queue with rate limiting. `sendMediaGroup` with 10 items burns 10 of your 30/sec quota, not 1. Honor the `adaptive_retry` header on 429 responses. |
| Claude API (PDF) | Sending encrypted or password-protected PDFs | Claude rejects these before token processing. Check for encryption before sending. Many real estate documents (bank statements, tax returns) arrive password-protected. |
| Claude API (PDF) | Not placing PDF content blocks before text blocks | Anthropic docs explicitly state: "Place PDFs before text in your requests" for optimal results. Reversed order degrades extraction quality. |
| Claude API (Vision) | Sending images larger than 1568px on the long edge | Claude auto-resizes, adding latency without quality benefit. Pre-resize images to max 1568px before sending. |
| iCloud Drive (macOS) | Using `~/Library/Mobile Documents/com~apple~CloudDocs/` without escaping spaces | The `Mobile Documents` path contains a space. All path references must be quoted or escaped. This bites shell scripts and some Node.js path operations. |
| Railway | Assuming persistent filesystem storage | Railway containers have ephemeral filesystems. Files written during processing are lost on restart. Use `/tmp` for transient work and external storage (S3, Supabase) for anything that needs to persist. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire large PDFs into memory for base64 encoding | Memory spikes, OOM crashes on Railway's limited container RAM | Stream files when possible; for Claude API, use the Files API (upload once, reference by `file_id`) instead of base64 encoding every time | Files >50MB on containers with <512MB RAM |
| Sequential document processing in a single Claude API call | 30-60 second response times for multi-document requests | Process documents individually in parallel (Promise.all), then synthesize results | More than 3 documents per request |
| Not using prompt caching for multi-question document analysis | Each question re-processes the full document's tokens, multiplying cost and latency | Add `cache_control: { type: "ephemeral" }` to document content blocks | Second+ question about the same document |
| Searching iCloud Drive with recursive directory traversal | Slow file discovery on deep folder structures with thousands of files | Build and maintain a file index/cache; update it incrementally rather than re-scanning on every request | Folder structures with >1000 files |
| Generating PDFs with Puppeteer (headless Chrome) on Railway | High memory usage (200-500MB for Chrome), slow cold starts, container OOM | Use PDFKit or pdfmake for programmatic PDF generation -- no browser needed for structured reports | Any container with <1GB RAM |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bot token committed to source code or git history | Anyone with the token can control the bot, read all messages, send messages as the bot. Telegram tokens don't expire until manually revoked. | Use environment variables exclusively. Add bot token patterns to `.gitignore`. If ever leaked, immediately revoke via BotFather and generate a new token. |
| Not validating Telegram webhook secret token | Attackers can send fake "updates" to your webhook endpoint, triggering arbitrary bot actions. | Set and validate `X-Telegram-Bot-Api-Secret-Token` header on every webhook request. grammY handles this if configured. |
| Storing sensitive real estate documents on Railway's ephemeral filesystem | Documents containing PII (SSNs, financial records) temporarily stored in an ephemeral container filesystem without encryption. | Process files in memory when possible. If writing to disk, use `/tmp`, encrypt at rest, and delete immediately after processing. Never log file contents. |
| Not restricting bot access to authorized users | Anyone who discovers the bot can trigger document processing, consuming API credits and potentially accessing private documents. | Implement allowlist-based access control: check `message.from.id` against a list of authorized Telegram user IDs (Sammy's ID: 5876179331). Reject all other users immediately. |
| Passing unsanitized filenames from iCloud Drive to shell commands | Path traversal or command injection via malicious filenames (e.g., `; rm -rf /`). | Never interpolate filenames into shell commands. Use Node.js `path.resolve()` and `path.normalize()` to sanitize. Use array-based `child_process.execFile()` instead of `exec()`. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during document processing | User sends a request, sees nothing for 30-60 seconds, thinks bot is broken, sends duplicate requests | Send `sendChatAction('typing')` or `sendChatAction('upload_document')` immediately. Send a "Processing X documents, this will take about Y seconds..." message. Update with progress if processing takes >15 seconds. |
| Confirmation step blocks workflow without clear instructions | User gets asked "Should I proceed?" but doesn't understand what they're confirming or how to respond | Make confirmation messages explicit: show what documents were found, what the summary will cover, and provide inline keyboard buttons (not free-text responses) for Yes/No/Modify. |
| Bot responds to file search queries with "no files found" without context | User doesn't know if the search failed, the query was wrong, or the files are in a different location | Include the search query, the directories searched, and suggestions: "I searched for 'appraisal' in /Real Estate/123 Main St/ and found 0 files. Try: broader search terms, checking the folder name, or sending the file directly." |
| Generated PDF is generic-looking and hard to scan | User receives a wall-of-text PDF that's hard to use in professional context | Design the PDF template with clear sections, headers, property address prominently displayed, key figures highlighted, and a table of contents for longer summaries. This is a real estate agent's deliverable -- it must look professional. |
| Bot doesn't handle mid-conversation context | User asks for a summary, then asks a follow-up question about the same documents, but bot treats it as a new request | Maintain conversation state per user. Remember the last set of documents processed and allow follow-up queries without re-uploading or re-searching. |

## "Looks Done But Isn't" Checklist

- [ ] **File download:** Handles Telegram's 20MB download limit -- verify by testing with a 25MB file
- [ ] **File upload:** Generated PDFs are checked for size before `sendDocument` -- verify by generating a PDF with many images
- [ ] **iCloud sync:** Files are confirmed to be locally present (not evicted placeholders) before reading -- verify by checking file size > 0
- [ ] **Claude API errors:** All API error responses are caught and surfaced to the user -- verify by testing with an encrypted PDF, an oversized PDF, and a rate-limited scenario
- [ ] **Bot resilience:** Bot recovers from network errors without manual restart -- verify by killing the network briefly and confirming polling resumes
- [ ] **Auth guard:** Unauthorized users get rejected immediately -- verify by messaging the bot from a different Telegram account
- [ ] **Document quality:** Scanned/image PDFs are detected and handled differently from digital PDFs -- verify by sending a photographed document
- [ ] **Cost tracking:** Token usage is logged for every Claude API call -- verify by checking logs after processing a large document
- [ ] **Webhook/Polling cleanup:** `deleteWebhook()` is called before starting polling -- verify by deploying twice in quick succession
- [ ] **Temp file cleanup:** Processing artifacts in `/tmp` are deleted after completion -- verify by checking filesystem after processing 50 documents
- [ ] **PDF output:** Generated PDF renders correctly in Telegram's inline viewer (not all PDFs do) -- verify by opening generated PDF in Telegram mobile AND desktop

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| iCloud Drive architecture wrong (built assuming direct access from Linux) | HIGH | Must redesign file access layer. Add sync agent or switch to alternative cloud storage. All file-reading code needs rewriting. |
| Token/cost overrun from uncontrolled Claude API usage | MEDIUM | Add token estimation gate, implement budget caps, switch to Sonnet for bulk processing (cheaper than Opus). Review and optimize prompts for token efficiency. |
| Bot token leaked in git history | MEDIUM | Immediately revoke token via BotFather (`/revoke`), generate new token, rotate in all environments, audit git history with `git filter-branch` or BFG Repo Cleaner. |
| Telegram file size limits hit in production | LOW | Add size checks and either compress files, use Local Bot API server, or switch to cloud storage links for large files. Mostly additive changes. |
| Bot polling loop crashes in production | LOW | Add `bot.catch()` error handler, configure Railway health checks, add process-level exception handlers. Can be patched without architectural changes. |
| Generated PDFs look unprofessional | LOW | Redesign PDF template. No architectural impact -- purely presentation layer changes. |
| OCR/extraction producing bad summaries | MEDIUM | Switch to Claude vision for document processing (if not already), add quality gates, add user-facing confidence indicators. May require rethinking the extraction pipeline. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| iCloud Drive file eviction | Phase 0/1: Architecture Decision | Test by reading a file that macOS has evicted; confirm the bot handles it gracefully |
| No iCloud Drive API on Linux | Phase 0: Architecture Decision | Confirm chosen file access method works from a Railway container before writing any file processing code |
| Claude API token/size limits | Phase 2: Document Processing | Process a 100-page PDF and verify token estimation matches actual usage within 20% |
| Telegram file size limits | Phase 1: Bot Foundation | Test uploading a 25MB file to the bot and sending a 55MB file from the bot; both should fail gracefully |
| Bot polling crash recovery | Phase 1: Bot Foundation | Kill the network connection during polling and verify the bot recovers within 30 seconds |
| OCR quality on scanned docs | Phase 2: Document Processing | Process 5 real scanned real estate documents and have the user verify summary accuracy |
| Security (auth, token, PII) | Phase 1: Bot Foundation | Verify unauthorized user rejection, token not in source, temp files cleaned up |
| PDF generation quality | Phase 3: PDF Generation | Generate summary PDF and have user evaluate professional quality |
| Cost management | Phase 2: Document Processing | Process 20 documents and verify total cost is within budget expectations |

## Sources

- [Telegram Bot API Official Documentation](https://core.telegram.org/bots/api) -- File limits, rate limits, webhook behavior (HIGH confidence)
- [Telegram Bot API Rate Limits](https://hfeu-telegram.com/news/telegram-bot-api-rate-limits-explained-856782827/) -- Detailed rate limit behavior (MEDIUM confidence)
- [Claude PDF Support - Anthropic Official Docs](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) -- PDF limits: 32MB, 100 pages, token costs (HIGH confidence)
- [Claude Vision - Anthropic Official Docs](https://platform.claude.com/docs/en/docs/build-with-claude/vision) -- Image processing limits (HIGH confidence)
- [grammY Reliability Guide](https://grammy.dev/advanced/reliability) -- Error handling, graceful shutdown, update guarantees (HIGH confidence)
- [iCloud Drive Terminal Access](https://www.igeeksblog.com/how-to-access-icloud-drive-from-terminal-on-mac/) -- macOS path, eviction behavior (MEDIUM confidence)
- [Apple Technical Note TN2336](https://developer.apple.com/library/archive/technotes/tn2336/_index.html) -- iCloud version conflicts (HIGH confidence)
- [pyicloud GitHub](https://github.com/picklepete/pyicloud) -- 2FA limitations, session expiry (MEDIUM confidence)
- [PDF Generation Node.js Tips & Gotchas - Joyfill](https://joyfill.io/blog/integrating-pdf-generation-into-node-js-backends-tips-gotchas) -- Puppeteer memory, PDFKit limitations (MEDIUM confidence)
- [Railway Deployment for Telegram Bots](https://kuberns.com/blogs/post/deploy-telegram-bot/) -- Persistent process considerations (MEDIUM confidence)
- [Telegram Local Bot API](https://bigmike.help/en/case/local-telegram-bot-api-advantages-limitations-of-the-standard-api-and-set-eb4a3b/) -- Bypassing file size limits (MEDIUM confidence)
- [OCR Accuracy Benchmarks](https://research.aimultiple.com/ocr-accuracy/) -- Tesseract vs alternatives accuracy data (MEDIUM confidence)

---
*Pitfalls research for: Telegram-controlled AI file agent with document summarization*
*Researched: 2026-02-19*
