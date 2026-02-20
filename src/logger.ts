import pino from "pino";

export function createLogger(): pino.Logger {
  const isDev = process.env.NODE_ENV !== "production";
  const level = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

  return pino({
    level,
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss",
          },
        }
      : undefined,
    base: { service: "telegram-file-agent" },
  });
}

export function createRequestLogger(
  parent: pino.Logger,
  updateId: number,
  userId?: number
): pino.Logger {
  return parent.child({
    requestId: `upd-${updateId}`,
    userId,
  });
}
