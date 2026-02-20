import type { MiddlewareFn } from "grammy";
import type pino from "pino";
import { createRequestLogger } from "../logger.js";
import type { BotContext } from "../types.js";

export function createLoggingMiddleware(
  parentLogger: pino.Logger
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const updateId = ctx.update.update_id;
    const userId = ctx.from?.id;
    const requestId = `upd-${updateId}`;

    const logger = createRequestLogger(parentLogger, updateId, userId);
    ctx.logger = logger;
    ctx.requestId = requestId;

    const updateType = Object.keys(ctx.update).filter(
      (k) => k !== "update_id"
    );

    logger.debug(
      { updateType, chatId: ctx.chat?.id },
      "Processing update"
    );

    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;

    logger.debug({ duration }, "Update processed");
  };
}
