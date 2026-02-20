import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { Logger } from "pino";

const LARGE_TEXT_THRESHOLD = 100 * 1024; // 100KB

export async function extractDocxText(
  buffer: Buffer,
  logger: Logger
): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });

  if (result.messages.length > 0) {
    logger.warn(
      { warnings: result.messages.map((m) => m.message) },
      "Mammoth conversion warnings"
    );
  }

  logger.info(
    { extractedLength: result.value.length },
    "DOCX text extracted via HTML conversion"
  );

  return result.value;
}

export async function extractSpreadsheetText(
  buffer: Buffer,
  fileName: string,
  logger: Logger
): Promise<string> {
  const workbook = XLSX.read(buffer);

  let totalRows = 0;
  const sheetTexts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet, {
      strip: true,
      blankrows: false,
    });
    sheetTexts.push(`## Sheet: ${sheetName}\n${csv}`);

    // Count non-empty rows
    const rows = csv.split("\n").filter((line) => line.trim().length > 0);
    totalRows += rows.length;
  }

  const combined = sheetTexts.join("\n\n");

  logger.info(
    { fileName, sheetCount: workbook.SheetNames.length, totalRows },
    "Spreadsheet text extracted"
  );

  if (combined.length > LARGE_TEXT_THRESHOLD) {
    logger.warn(
      { fileName, textLength: combined.length, thresholdKB: 100 },
      "Extracted spreadsheet text exceeds 100KB -- potential high token cost"
    );
  }

  return combined;
}
