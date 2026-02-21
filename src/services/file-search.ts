import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { Logger } from "pino";

export interface SearchResult {
  name: string;
  path: string;
  size: number;
  modified: Date;
  extension: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".docx",
  ".xlsx",
  ".csv",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".Trash",
  ".DS_Store",
]);

/**
 * Recursively search iCloud Drive for files matching the query.
 * Matches against file names (case-insensitive) and parent folder names.
 */
export async function searchFiles(
  rootPath: string,
  query: string,
  logger: Logger,
  maxResults = 20
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  logger.info({ rootPath, query, terms }, "Starting iCloud Drive search");

  await walkDirectory(rootPath, terms, results, maxResults, logger);

  // Sort by modification date (newest first)
  results.sort((a, b) => b.modified.getTime() - a.modified.getTime());

  logger.info(
    { query, resultCount: results.length },
    "iCloud Drive search complete"
  );

  return results;
}

async function walkDirectory(
  dirPath: string,
  terms: string[],
  results: SearchResult[],
  maxResults: number,
  logger: Logger
): Promise<void> {
  if (results.length >= maxResults) return;

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    // Permission denied or iCloud placeholder not downloaded — skip silently
    logger.debug({ dirPath, error: (err as Error).message }, "Skipping directory");
    return;
  }

  const subdirs: string[] = [];

  for (const entry of entries) {
    if (results.length >= maxResults) break;

    if (SKIP_DIRS.has(entry.name)) continue;
    // Skip hidden files/dirs (except iCloud placeholders)
    if (entry.name.startsWith(".") && !entry.name.endsWith(".icloud")) continue;

    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      subdirs.push(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    // Match query terms against filename and parent folder path
    const searchTarget = fullPath.toLowerCase();
    const allTermsMatch = terms.every((term) => searchTarget.includes(term));

    if (!allTermsMatch) continue;

    try {
      const fileStat = await stat(fullPath);
      results.push({
        name: basename(entry.name),
        path: fullPath,
        size: fileStat.size,
        modified: fileStat.mtime,
        extension: ext,
      });
    } catch {
      // File may be an iCloud placeholder not yet downloaded — skip
    }
  }

  // Recurse into subdirectories
  for (const subdir of subdirs) {
    if (results.length >= maxResults) break;
    await walkDirectory(subdir, terms, results, maxResults, logger);
  }
}

/**
 * Get the MIME type for a file extension.
 */
export function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
  };
  return mimeMap[ext.toLowerCase()] ?? "application/octet-stream";
}
