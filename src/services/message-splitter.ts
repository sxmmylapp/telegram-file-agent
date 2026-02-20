const TELEGRAM_MAX_LENGTH = 4096;

export function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIndex = remaining.lastIndexOf("\n\n", TELEGRAM_MAX_LENGTH);
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_LENGTH / 2) {
      // Fall back to newline
      splitIndex = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    }
    if (splitIndex === -1 || splitIndex < TELEGRAM_MAX_LENGTH / 2) {
      // Fall back to hard cut
      splitIndex = TELEGRAM_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
