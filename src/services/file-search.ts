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
 * Recursively search multiple root paths for files matching the query.
 * Matches against file names (case-insensitive) and parent folder names.
 * Searches all paths in parallel, merges and deduplicates results.
 */
export async function searchFiles(
  rootPaths: string | string[],
  query: string,
  logger: Logger,
  maxResults = 20
): Promise<SearchResult[]> {
  const paths = Array.isArray(rootPaths) ? rootPaths : [rootPaths];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  logger.info({ rootPaths: paths, query, terms }, "Starting file search");

  // Search all paths in parallel
  const perPathResults = await Promise.all(
    paths.map(async (rootPath) => {
      const results: SearchResult[] = [];
      await walkDirectory(rootPath, terms, results, maxResults, logger);
      return results;
    })
  );

  // Merge, deduplicate by path, sort by modification date (newest first)
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const results of perPathResults) {
    for (const r of results) {
      if (!seen.has(r.path)) {
        seen.add(r.path);
        merged.push(r);
      }
    }
  }

  merged.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  const final = merged.slice(0, maxResults);

  logger.info(
    { query, resultCount: final.length, pathsSearched: paths.length },
    "File search complete"
  );

  return final;
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
