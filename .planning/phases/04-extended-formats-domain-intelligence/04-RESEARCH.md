# Phase 4: Extended Formats & Domain Intelligence - Research

**Researched:** 2026-02-19
**Domain:** Word/spreadsheet parsing + real estate domain intelligence for Claude summarization
**Confidence:** HIGH

## Summary

Phase 4 adds two capabilities: (1) parsing Word (.docx) and spreadsheet (.xlsx/.csv) files so they can be sent to Claude for summarization, and (2) enhancing the system prompt to extract real estate-specific structured data from ALL document types. The parsing libraries are well-established (mammoth for .docx, SheetJS for .xlsx/.csv) and the integration pattern mirrors the existing thin-handler architecture -- parse file to text, build content blocks, delegate to Claude service.

The key architectural insight is that Word and spreadsheet content must be converted to text BEFORE sending to Claude (unlike PDFs/images which Claude handles natively). This means adding a text extraction layer between file download and Claude API call. The real estate domain intelligence is a system prompt enhancement that applies to ALL summaries (existing PDF/image flows too), not just the new formats.

**Primary recommendation:** Add mammoth and SheetJS as extraction services, route new MIME types through document handler, and enhance the Claude system prompt with explicit real estate data extraction fields.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROC-03 | Bot parses Word documents (.docx) via mammoth | mammoth v1.11.0 `extractRawText({buffer})` converts .docx to plain text; `convertToHtml({buffer})` preserves table structure as HTML -- both accept Node.js Buffer directly from Telegram download |
| PROC-04 | Bot parses spreadsheets (.xlsx/.csv) via SheetJS | SheetJS v0.20.3 `XLSX.read(buffer)` parses both .xlsx and .csv; `sheet_to_csv()` and `sheet_to_json()` utilities convert to text for Claude consumption |
| SUMM-03 | Summary extracts real estate-specific data (dates, prices, parties, contingencies, property details) | Enhanced system prompt with explicit extraction fields; Anthropic's legal summarization guide recommends listing specific details_to_extract with structured output sections |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mammoth | 1.11.0 | Parse .docx to text/HTML | Only serious .docx-to-text library in Node.js; built-in TypeScript types since v1.4.19; 600+ npm dependents |
| xlsx (SheetJS CE) | 0.20.3 | Parse .xlsx and .csv | De facto standard spreadsheet parser; handles xlsx, xls, csv, ods; built-in TypeScript types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Both core libs handle all requirements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mammoth | docx4js, officeparser | mammoth is more mature, better maintained, specified in PROC-03 |
| SheetJS | exceljs, node-xlsx | SheetJS handles CSV natively too; specified in PROC-04 |

### Installation

**IMPORTANT:** SheetJS has moved off the npm registry. The npm `xlsx` package is stuck at v0.18.5 which has known CVE-2023-30533 vulnerability. Must install from SheetJS CDN.

```bash
# mammoth - standard npm install
npm install mammoth

# SheetJS - MUST install from CDN (npm registry version is outdated and vulnerable)
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

## Architecture Patterns

### Text Extraction Service Layer

New file: `src/services/text-extractor.ts` -- extracts text from .docx and .xlsx/.csv files, returning a string that gets passed as a text content block to Claude.

```
src/
├── services/
│   ├── claude.ts            # (existing) enhanced system prompt for SUMM-03
│   ├── text-extractor.ts    # NEW: mammoth + SheetJS extraction
│   ├── file-download.ts     # (existing) unchanged
│   ├── pdf-generator.ts     # (existing) unchanged
│   └── message-splitter.ts  # (existing) unchanged
├── handlers/
│   └── documents.ts         # (modified) route new MIME types, build text content blocks
└── types.ts                 # (modified) add supported MIME type constants
```

### Pattern 1: Text Content Block for Pre-Parsed Documents

**What:** For .docx and spreadsheets, extract text first, then send as a text content block (unlike PDF/image which use document/image content blocks).

**When to use:** Any file format Claude cannot process natively.

**Example:**
```typescript
// Source: existing codebase pattern + mammoth/SheetJS docs
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  // convertToHtml preserves tables as <table> HTML -- better for Claude
  // than extractRawText which loses all table structure
  return result.value;
}

export async function extractSpreadsheetText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const workbook = XLSX.read(buffer);
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet, {
      strip: true,
      blankrows: false,
    });
    sheets.push(`## Sheet: ${sheetName}\n${csv}`);
  }

  return sheets.join("\n\n");
}
```

### Pattern 2: MIME Type Routing in Document Handler

**What:** Expand the document handler to recognize .docx and spreadsheet MIME types, extract text, and build text-only content blocks for Claude.

**When to use:** In the existing `documentHandlers.on("message:document")` handler.

**Example:**
```typescript
// MIME type constants
const SUPPORTED_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
} as const;

// In document handler, after downloading buffer:
const isDocx = mimeType === SUPPORTED_MIME_TYPES.docx;
const isXlsx = mimeType === SUPPORTED_MIME_TYPES.xlsx;
const isCsv = mimeType === SUPPORTED_MIME_TYPES.csv ||
              fileName.endsWith(".csv"); // CSV MIME type can be unreliable

if (isDocx) {
  const text = await extractDocxText(buffer);
  contentBlocks = [
    { type: "text" as const, text: `Document content (converted from Word .docx):\n\n${text}` },
    { type: "text" as const, text: "Please provide an executive summary of this document." },
  ];
} else if (isXlsx || isCsv) {
  const text = await extractSpreadsheetText(buffer, fileName);
  contentBlocks = [
    { type: "text" as const, text: `Spreadsheet content:\n\n${text}` },
    { type: "text" as const, text: "Please provide an executive summary of this spreadsheet data." },
  ];
}
```

### Pattern 3: Enhanced Real Estate System Prompt (SUMM-03)

**What:** Enhance the existing system prompt in `claude.ts` to explicitly extract real estate-specific fields.

**When to use:** Applies to ALL summarizations (PDF, image, docx, spreadsheet).

**Example:**
```typescript
const SYSTEM_PROMPT = `You are a real estate document analyst. Produce an executive summary with these sections:

## Key Details
- Document type and purpose
- Parties involved (names, roles — buyer, seller, agent, lender, attorney)
- Property details (address, legal description, parcel number, property type)
- Key dates (execution, effective, expiration, closing, inspection deadlines, financing deadline)
- Financial amounts (purchase price, earnest money deposit, down payment, loan amount, closing costs, commission)
- Critical terms and conditions

## Real Estate Data
- **Property:** Full address, lot/block, subdivision, county, property type (residential, commercial, land)
- **Transaction:** Purchase price, earnest money, financing type (conventional, FHA, VA, cash)
- **Dates:** Contract date, closing date, inspection period, financing contingency deadline, appraisal deadline
- **Parties:** Buyer(s), seller(s), listing agent, buyer's agent, title company, lender
- **Contingencies:** Inspection, financing, appraisal, sale of buyer's property, HOA review
- **Special Provisions:** Seller concessions, repair credits, included/excluded items, HOA fees

## Highlights
- Notable or favorable terms
- Important deadlines or milestones
- Unique provisions or concessions

## Concerns
- Potential risks or red flags
- Missing information or ambiguities
- Items requiring follow-up or legal review
- Unusual or non-standard clauses
- Approaching or passed deadlines

Keep the summary concise but thorough (1-2 pages equivalent). Focus on actionable information. For any real estate data field not found in the document, omit it rather than stating "not specified".`;
```

### Anti-Patterns to Avoid

- **Sending .docx/.xlsx binary data as base64 to Claude:** Claude cannot natively parse Word or Excel formats. These MUST be converted to text/HTML first.
- **Using extractRawText for .docx:** Loses table structure entirely. Use `convertToHtml` instead -- Claude handles HTML well and tables are common in real estate docs.
- **Installing SheetJS from npm registry:** The npm version (0.18.5) has known CVE-2023-30533 vulnerability. Always install from cdn.sheetjs.com.
- **Ignoring CSV MIME type inconsistency:** Telegram may send CSV files with `text/csv`, `text/comma-separated-values`, `application/csv`, or even `application/octet-stream`. Fall back to file extension check.
- **Separate system prompts for different formats:** The real estate extraction (SUMM-03) applies to ALL summaries. Use one enhanced prompt, not format-specific prompts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .docx parsing | Custom XML/ZIP parser | mammoth | .docx is a complex ZIP of XML files with styles, relationships, headers, footers -- mammoth handles it all |
| .xlsx parsing | Custom XML/ZIP parser | SheetJS | .xlsx is also a complex ZIP; cell references, formulas, shared strings, date encoding are all edge cases |
| CSV parsing | Custom split-on-comma | SheetJS `XLSX.read()` | CSV has quoting rules, embedded commas, newlines in fields, encoding issues. SheetJS handles all of this AND can parse CSV into the same workbook interface as .xlsx |
| Real estate NER | Custom regex extraction | Claude system prompt | Claude already understands real estate terminology. Prompt engineering is more maintainable than regex patterns for dates, prices, and party names |

**Key insight:** Both mammoth and SheetJS accept Node.js Buffer directly -- no filesystem writes needed. This matches the existing buffer-based pattern (download from Telegram -> process in memory -> send to Claude).

## Common Pitfalls

### Pitfall 1: SheetJS ESM Import Requires Manual Setup
**What goes wrong:** `XLSX.readFile()` and other filesystem methods fail silently in ESM mode.
**Why it happens:** SheetJS ESM build does not auto-load Node.js `fs` module.
**How to avoid:** We only use `XLSX.read(buffer)` which does NOT need filesystem access. No `set_fs()` call needed since we pass buffers directly. But if filesystem access is ever needed, call `XLSX.set_fs(fs)` after import.
**Warning signs:** "Cannot read properties of undefined" errors when calling XLSX methods.

### Pitfall 2: CSV MIME Type Detection
**What goes wrong:** CSV files arrive with inconsistent MIME types from Telegram.
**Why it happens:** Telegram relies on the sender's OS to determine MIME type. CSV files may arrive as `text/csv`, `text/comma-separated-values`, `application/csv`, `application/vnd.ms-excel`, or `application/octet-stream`.
**How to avoid:** Check MIME type first, then fall back to file extension (`.csv`). Use a set of known CSV MIME types plus extension check.
**Warning signs:** CSV files being rejected as "unsupported format".

### Pitfall 3: Large Spreadsheets Blowing Token Limits
**What goes wrong:** A spreadsheet with thousands of rows converts to enormous text, exceeding Claude's context window or costing excessive tokens.
**Why it happens:** `sheet_to_csv()` outputs ALL rows. A 5000-row spreadsheet with 10 columns could be 500KB+ of text.
**How to avoid:** Truncate or sample large spreadsheets. Log a warning if extracted text exceeds a threshold (e.g., 100KB). Consider sending only first N rows with a note about total row count.
**Warning signs:** Token estimation returning very high counts, Claude API timeouts, expensive API calls.

### Pitfall 4: mammoth convertToHtml Output Size
**What goes wrong:** Very large .docx files produce massive HTML output.
**Why it happens:** mammoth faithfully converts all content including embedded objects.
**How to avoid:** Log the size of extracted text. mammoth's `result.messages` array contains warnings -- log those too.
**Warning signs:** `result.messages` containing warnings about unsupported features.

### Pitfall 5: SheetJS CDN Package in package-lock.json
**What goes wrong:** `npm install` on a fresh clone fails to resolve the SheetJS package.
**Why it happens:** The CDN URL is stored in package-lock.json. If the CDN is down or the URL changes, installs break.
**How to avoid:** Consider vendoring the tarball in the repo (download to `vendor/xlsx-0.20.3.tgz`, install with `file:vendor/xlsx-0.20.3.tgz`). Or accept the CDN dependency risk (it has been stable).
**Warning signs:** CI/CD install failures mentioning xlsx package.

### Pitfall 6: System Prompt Change Affects Existing Flows
**What goes wrong:** Enhancing the system prompt for SUMM-03 changes the output format of existing PDF/image summaries.
**Why it happens:** SUMM-03 requires real estate extraction for ALL summaries, so the enhanced prompt applies everywhere.
**How to avoid:** This is intentional and desired. But verify that the PDF generator still parses the enhanced summary correctly -- the new "Real Estate Data" section uses the same `## Heading` + bullet format that `parseSummarySections()` already handles.
**Warning signs:** PDF output missing sections or rendering incorrectly after prompt change.

## Code Examples

Verified patterns from official sources:

### mammoth: Extract HTML from .docx Buffer
```typescript
// Source: mammoth.js README (https://github.com/mwilliamson/mammoth.js)
import mammoth from "mammoth";

const result = await mammoth.convertToHtml({ buffer: docxBuffer });
const html = result.value; // HTML string with <table>, <p>, <h1>, etc.
const warnings = result.messages; // Array of warning objects

// For raw text (loses table structure -- avoid for real estate docs):
// const result = await mammoth.extractRawText({ buffer: docxBuffer });
// const text = result.value; // Plain text, paragraphs separated by \n\n
```

### SheetJS: Parse .xlsx/.csv Buffer to CSV Text
```typescript
// Source: SheetJS docs (https://docs.sheetjs.com/docs/api/utilities/csv/)
import * as XLSX from "xlsx";

const workbook = XLSX.read(buffer); // Auto-detects format (xlsx, csv, etc.)

// Iterate all sheets
for (const sheetName of workbook.SheetNames) {
  const ws = workbook.Sheets[sheetName];

  // Option A: CSV output (good for Claude text processing)
  const csv = XLSX.utils.sheet_to_csv(ws, { strip: true, blankrows: false });

  // Option B: JSON output (structured data)
  const json = XLSX.utils.sheet_to_json(ws);
}
```

### SheetJS: ESM Import with esbuild
```typescript
// Source: SheetJS esbuild docs (https://docs.sheetjs.com/docs/demos/frontend/bundler/esbuild/)
// For buffer-only usage (no filesystem), ESM import works directly:
import * as XLSX from "xlsx";

// Only needed if using readFile/writeFile (we don't):
// import * as fs from "fs";
// XLSX.set_fs(fs);
```

### Enhanced Content Block for Pre-Parsed Documents
```typescript
// Pattern: text-only content blocks for non-native Claude formats
const contentBlocks = [
  {
    type: "text" as const,
    text: `The following is the content of a Word document titled "${fileName}":\n\n${extractedHtml}`,
  },
  {
    type: "text" as const,
    text: "Please provide an executive summary of this document.",
  },
];

// This follows the same interface as existing PDF/image content blocks
await estimateTokens(contentBlocks, ctx.logger);
const summary = await summarizeDocument(contentBlocks, ctx.logger);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm `xlsx` v0.18.5 | CDN `xlsx` v0.20.3 | 2023 | Must install from cdn.sheetjs.com; npm version has CVE-2023-30533 |
| mammoth.extractRawText | mammoth.convertToHtml | Always available | HTML preserves table structure which is critical for real estate documents with tabular data |
| Generic summarization prompt | Domain-specific extraction fields | Anthropic legal summarization guide | Listing specific fields to extract produces far more consistent, structured output |

**Deprecated/outdated:**
- `@types/xlsx` -- do NOT install. SheetJS bundles its own TypeScript types at `xlsx/types/index.d.ts`.
- `@types/mammoth` -- do NOT install. mammoth bundles TypeScript types since v1.4.19.
- `npm install xlsx` -- do NOT use. Installs vulnerable v0.18.5 from npm registry.

## Open Questions

1. **mammoth convertToHtml vs extractRawText for Claude input**
   - What we know: `convertToHtml` preserves tables as `<table>` HTML; `extractRawText` loses all structure. Claude processes HTML well.
   - What's unclear: Whether the HTML overhead (tags) wastes tokens vs. the structural benefit for real estate docs with tables.
   - Recommendation: Use `convertToHtml`. Real estate documents frequently contain tables (closing cost worksheets, comparison sheets, etc.). The structural preservation outweighs the minor token overhead. Claude handles HTML natively.

2. **Spreadsheet row limits for token management**
   - What we know: Large spreadsheets could produce massive text. The existing `estimateTokens` call will catch this.
   - What's unclear: What's a reasonable row limit before truncation.
   - Recommendation: Start without a hard limit -- let `estimateTokens` report the cost. Add truncation if real-world usage shows excessively large spreadsheets. Log row count for monitoring.

3. **CSV MIME type detection completeness**
   - What we know: Telegram sends various MIME types for CSV. Common ones: `text/csv`, `text/comma-separated-values`.
   - What's unclear: Full set of MIME types Telegram might send for CSV files.
   - Recommendation: Check a set of known CSV MIME types + file extension fallback. Log unrecognized MIME types to expand the set over time.

## Sources

### Primary (HIGH confidence)
- mammoth.js README (https://github.com/mwilliamson/mammoth.js) - API methods, buffer support, TypeScript types, table handling
- SheetJS Official Docs (https://docs.sheetjs.com/) - Installation, API reference, ESM/esbuild configuration, CSV/JSON utilities
- SheetJS NodeJS Installation (https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) - CDN installation, version 0.20.3
- SheetJS esbuild docs (https://docs.sheetjs.com/docs/demos/frontend/bundler/esbuild/) - ESM import pattern, platform=node flag
- Anthropic Legal Summarization Guide (https://platform.claude.com/docs/en/about-claude/use-case-guides/legal-summarization) - System prompt patterns, structured extraction, details_to_extract approach

### Secondary (MEDIUM confidence)
- SheetJS CSV utilities docs (https://docs.sheetjs.com/docs/api/utilities/csv/) - sheet_to_csv options verified against official docs
- mammoth npm page - Version 1.11.0 confirmed, 600+ dependents
- SheetJS npm migration (https://github.com/SheetJS/sheetjs/issues/2667) - Reason for CDN move, npm registry status

### Tertiary (LOW confidence)
- CSV MIME type variations from Telegram - based on general web search, not Telegram-specific documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mammoth and SheetJS are the established libraries specified in requirements; versions and APIs verified against official docs
- Architecture: HIGH - follows existing thin-handler + service layer pattern; buffer-based flow matches current codebase exactly
- Pitfalls: HIGH - SheetJS CDN install requirement and ESM gotchas verified against official docs; CSV MIME type issue is well-documented
- Domain intelligence (SUMM-03): MEDIUM - prompt design based on Anthropic's legal summarization guide and existing prompt structure; may need iteration after real-world testing

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable libraries, unlikely to change significantly)
