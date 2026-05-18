// ─── Structured Logger ──────────────────────────────────────────────────────
// Winston-based logger with console and optional file transports.
// Log level is driven by NODE_ENV (production → info, else → debug).

const winston = require("winston");

const isProduction = process.env.NODE_ENV === "production";

// In containerised environments (App Runner, ECS, Docker) stdout/stderr are
// captured by the platform (CloudWatch). File transports require a writable
// filesystem and cause EACCES crashes when running as a non-root user.
// Use console-only transport everywhere; local devs can tail stdout.

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : "";
            return `${timestamp} [${level}]: ${message}${metaStr}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// ─── Morgan stream wrapper ──────────────────────────────────────────────────
// Allows morgan HTTP request logging to be piped through winston.

logger.morganStream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
