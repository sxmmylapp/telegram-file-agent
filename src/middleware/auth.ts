import type { MiddlewareFn } from "grammy";
import type { BotContext } from "../types.js";

export function createAuthMiddleware(
  authorizedUserIds: number[]
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId) {
      ctx.logger?.warn(
        { chatId: ctx.chat?.id },
        "Rejected update with no user (channel post or anonymous)"
      );
      return;
    }

    if (!authorizedUserIds.includes(userId)) {
      ctx.logger?.warn(
        { attemptedUserId: userId, chatId: ctx.chat?.id },
        "Unauthorized access attempt"
      );
      await ctx.reply("This bot is private. Access denied.");
      return;
    }

    await next();
  };
}
