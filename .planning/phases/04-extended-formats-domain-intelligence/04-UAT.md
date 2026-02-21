---
status: testing
phase: 04-extended-formats-domain-intelligence
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-02-20T04:35:00Z
updated: 2026-02-20T04:35:00Z
---

## Current Test

number: 1
name: Send a Word document (.docx) and receive summary
expected: |
  Send a .docx file to the bot. Bot acknowledges receipt, processes it through mammoth text extraction, sends it to Claude for summarization, and replies with an executive summary text message followed by a PDF attachment.
awaiting: user response

## Tests

### 1. Send a Word document (.docx) and receive summary
expected: Send a .docx file to the bot. Bot acknowledges receipt, processes it through mammoth text extraction, sends it to Claude for summarization, and replies with an executive summary text message followed by a PDF attachment.
result: [pending]

### 2. Send an Excel spreadsheet (.xlsx) and receive summary
expected: Send a .xlsx file to the bot. Bot acknowledges receipt, extracts spreadsheet data via SheetJS, sends to Claude, and replies with an executive summary text message followed by a PDF attachment.
result: [pending]

### 3. Send a CSV file and receive summary
expected: Send a .csv file to the bot. Bot acknowledges receipt, detects CSV format (even if Telegram sends an unusual MIME type), extracts data via SheetJS, and replies with summary text + PDF.
result: [pending]

### 4. Real estate domain intelligence in summaries
expected: When summarizing any real estate document (contract, disclosure, listing), the summary includes a "Real Estate Data" section with structured fields: property details, transaction terms, dates, parties, contingencies, and special provisions. Fields not found in the document are omitted (no "not specified" filler).
result: [pending]

### 5. Unsupported file type gets helpful error
expected: Send an unsupported file type (e.g., .mp3, .zip) to the bot. Bot replies with a message listing all supported formats: PDF, images, Word (.docx), and spreadsheets (.xlsx, .csv).
result: [pending]

### 6. Existing PDF and image flows still work
expected: Send a PDF document and an image to the bot (separately). Both should still produce executive summaries with text + PDF attachment, unchanged from before Phase 4.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
