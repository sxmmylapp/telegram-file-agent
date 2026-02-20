import PDFDocument from "pdfkit";
import type { Logger } from "pino";

export interface PdfMetadata {
  sourceFileName: string;
  generatedAt: Date;
}

interface SummarySection {
  heading: string;
  items: string[];
}

/**
 * Parse Claude's structured markdown output into typed sections.
 * Each section starts with a `## Heading` line and contains bullet items
 * or paragraph text.
 */
function parseSummarySections(markdown: string): SummarySection[] {
  const sections: SummarySection[] = [];
  let currentSection: SummarySection | null = null;

  const lines = markdown.split("\n");

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { heading: headingMatch[1].trim(), items: [] };
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      currentSection.items.push(bulletMatch[1].trim());
      continue;
    }

    // Continuation text (non-blank, non-heading, non-bullet)
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      // Append to last item if exists, otherwise create new item
      if (currentSection.items.length > 0) {
        currentSection.items[currentSection.items.length - 1] += " " + trimmed;
      } else {
        currentSection.items.push(trimmed);
      }
    }
  }

  // Push the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Render text with inline bold and italic formatting.
 * Splits on bold (**text**) and italic (*text*) markers, switching fonts
 * using the `continued` option to keep text on the same line.
 */
function renderFormattedText(
  doc: InstanceType<typeof PDFDocument>,
  text: string
): void {
  // Split on bold and italic markers, keeping the delimiters
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  const filteredSegments = segments.filter((s) => s.length > 0);

  if (filteredSegments.length === 0) {
    doc.font("Helvetica").text("", { continued: false });
    return;
  }

  for (let i = 0; i < filteredSegments.length; i++) {
    const segment = filteredSegments[i];
    const isLast = i === filteredSegments.length - 1;

    if (segment.startsWith("**") && segment.endsWith("**")) {
      // Bold text
      const content = segment.slice(2, -2);
      doc.font("Helvetica-Bold").text(content, { continued: !isLast });
    } else if (segment.startsWith("*") && segment.endsWith("*")) {
      // Italic text
      const content = segment.slice(1, -1);
      doc.font("Helvetica-Oblique").text(content, { continued: !isLast });
    } else {
      // Normal text
      doc.font("Helvetica").text(segment, { continued: !isLast });
    }
  }

  // Always reset font to Helvetica to avoid font bleed
  doc.font("Helvetica");
}

/**
 * Render the document header on the first page.
 */
function renderHeader(
  doc: InstanceType<typeof PDFDocument>,
  metadata: PdfMetadata
): void {
  // Title
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#1a1a1a")
    .text("EXECUTIVE SUMMARY");

  // Source filename
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#666666")
    .text(metadata.sourceFileName);

  // Generated date
  const dateStr = metadata.generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.font("Helvetica").fontSize(10).fillColor("#666666").text(dateStr);

  // Horizontal rule
  doc.moveDown(0.5);
  const y = doc.y;
  doc
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();

  // Space after rule
  doc.moveDown(1);
}

/**
 * Render a single section with heading and bullet items.
 */
function renderSection(
  doc: InstanceType<typeof PDFDocument>,
  section: SummarySection
): void {
  // Section heading
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#2c3e50")
    .text(section.heading);

  // 8pt space after heading
  doc.moveDown(0.5);

  // Render each item as a bullet point
  for (let i = 0; i < section.items.length; i++) {
    const item = section.items[i];

    // Bullet character
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#333333");

    // Render bullet with indentation
    const bulletX = doc.page.margins.left + 15;
    const textX = doc.page.margins.left + 25;
    const currentY = doc.y;

    doc.text("\u2022", bulletX, currentY, {
      continued: false,
      width: 10,
    });

    // Move back up to same line for item text
    doc.y = currentY;
    doc.x = textX;

    // Render the formatted text at the indented position
    doc.fontSize(11).fillColor("#333333");
    renderFormattedText(doc, item);

    // 6pt space between items
    if (i < section.items.length - 1) {
      doc.moveDown(0.3);
    }
  }

  // 16pt space after section
  doc.moveDown(1);
}

/**
 * Add page numbers ("Page X of Y") at the bottom of each page.
 */
function addPageNumbers(doc: InstanceType<typeof PDFDocument>): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const pageNum = i - range.start + 1;
    const text = `Page ${pageNum} of ${totalPages}`;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#888888")
      .text(text, 0, doc.page.height - 50, {
        align: "center",
        width: doc.page.width,
      });
  }
}

/**
 * Generate a professionally formatted PDF from a markdown summary.
 *
 * @param summaryMarkdown - Claude's structured markdown output with ## headings and bullets
 * @param metadata - Source file name and generation timestamp
 * @param logger - Pino logger instance
 * @returns Buffer containing the PDF bytes
 */
export async function generateSummaryPdf(
  summaryMarkdown: string,
  metadata: PdfMetadata,
  logger: Logger
): Promise<Buffer> {
  logger.info(
    { sourceFileName: metadata.sourceFileName },
    "PDF generation started"
  );

  const doc = new PDFDocument({
    size: "letter",
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    bufferPages: true,
    info: {
      Title: `Executive Summary - ${metadata.sourceFileName}`,
      Author: "Telegram File Agent",
    },
  });

  // Set up buffer collection BEFORE any content rendering
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const bufferPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Render content
  renderHeader(doc, metadata);

  const sections = parseSummarySections(summaryMarkdown);
  for (const section of sections) {
    renderSection(doc, section);
  }

  // Add page numbers after all content
  addPageNumbers(doc);

  // Finalize the PDF
  doc.end();

  const buffer = await bufferPromise;

  const pageCount = doc.bufferedPageRange().count;
  logger.info(
    {
      sourceFileName: metadata.sourceFileName,
      pageCount,
      bufferSizeBytes: buffer.length,
    },
    "PDF generation complete"
  );

  return buffer;
}
