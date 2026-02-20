import Anthropic from "@anthropic-ai/sdk";
import type { Logger } from "pino";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MAX_OUTPUT_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a real estate document analyst. Produce an executive summary with these sections:

## Key Details
- Document type and purpose
- Parties involved (names, roles)
- Key dates (execution, effective, expiration)
- Financial amounts (purchase price, deposits, fees)
- Critical terms and conditions

## Highlights
- Notable or favorable terms
- Important deadlines or milestones
- Unique provisions or concessions

## Concerns
- Potential risks or red flags
- Missing information or ambiguities
- Items requiring follow-up or legal review
- Unusual or non-standard clauses

Keep the summary concise but thorough (1-2 pages equivalent). Focus on actionable information.`;

type ContentBlocks = Anthropic.MessageCreateParams["messages"][0]["content"];

interface TokenEstimate {
  inputTokens: number;
  estimatedCostUsd: number;
}

export async function estimateTokens(
  contentBlocks: ContentBlocks,
  logger: Logger
): Promise<TokenEstimate> {
  const response = await client.messages.countTokens({
    model: config.CLAUDE_MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const inputTokens = response.input_tokens;
  // Sonnet 4.6 pricing: $3/MTok input, $15/MTok output
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * 3 + (MAX_OUTPUT_TOKENS / 1_000_000) * 15;

  logger.info(
    {
      inputTokens,
      estimatedCostUsd: estimatedCostUsd.toFixed(4),
      model: config.CLAUDE_MODEL,
    },
    "Token estimate before API call"
  );

  return { inputTokens, estimatedCostUsd };
}

export async function summarizeDocument(
  contentBlocks: ContentBlocks,
  logger: Logger
): Promise<string> {
  const message = await client.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  logger.info(
    {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model: config.CLAUDE_MODEL,
    },
    "Claude API call completed"
  );

  return textBlock.text;
}
