import { Context } from "grammy";
import { FileFlavor } from "@grammyjs/files";
import type { Logger } from "pino";

export interface BotContextFlavor {
  logger: Logger;
  requestId: string;
}

export type BotContext = FileFlavor<Context> & BotContextFlavor;
