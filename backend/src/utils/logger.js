// ─── Structured Logger ──────────────────────────────────────────────────────
// Winston-based logger with console and optional file transports.
// Log level is driven by NODE_ENV (production → info, else → debug).

const winston = require("winston");

const isProduction = process.env.NODE_ENV === "production";

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
    // Always write errors to a file for debugging in production
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    }),
    // Combined log (info and above)
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3,
          }),
        ]
      : []),
  ],
});

// ─── Morgan stream wrapper ──────────────────────────────────────────────────
// Allows morgan HTTP request logging to be piped through winston.

logger.morganStream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
