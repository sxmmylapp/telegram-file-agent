import Anthropic from "@anthropic-ai/sdk";
import type { Logger } from "pino";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MAX_OUTPUT_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a real estate document analyst. Produce an executive summary with these sections:

## Key Details
- Document type and purpose
- Parties involved (names, roles -- buyer, seller, agent, lender, attorney)
- Property details (address, legal description, parcel number, property type)
- Key dates (execution, effective, expiration, closing, inspection deadlines, financing deadline)
- Financial amounts (purchase price, earnest money deposit, down payment, loan amount, closing costs, commission)
- Critical terms and conditions

## Real Estate Data
- Property: Full address, lot/block, subdivision, county, property type (residential, commercial, land)
- Transaction: Purchase price, earnest money, financing type (conventional, FHA, VA, cash)
- Dates: Contract date, closing date, inspection period, financing contingency deadline, appraisal deadline
- Parties: Buyer(s), seller(s), listing agent, buyer's agent, title company, lender
- Contingencies: Inspection, financing, appraisal, sale of buyer's property, HOA review
- Special Provisions: Seller concessions, repair credits, included/excluded items, HOA fees

## Highlights
- Notable or favorable terms
- Important deadlines or milestones
- Unique provisions or concessions

## Concerns
- Potential risks or red flags
- Missing information or ambiguities
- Items requiring follow-up or legal review
- Unusual or non-standard clauses

For any real estate data field not found in the document, omit it rather than stating 'not specified'.

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
