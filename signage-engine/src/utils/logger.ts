import pino from 'pino';

// Create logger instance with pretty printing in development
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

// Log buffer for admin UI access
interface LogEntry {
  level: string;
  time: number;
  msg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

/**
 * Add a log entry to the buffer (for admin UI access)
 */
export function addToLogBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

/**
 * Get recent log entries
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

/**
 * Clear the log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

// Wrap logger to also add to buffer
const originalInfo = logger.info.bind(logger);
const originalWarn = logger.warn.bind(logger);
const originalError = logger.error.bind(logger);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
logger.info = (obj: any, msg?: string, ...args: any[]) => {
  const entry: LogEntry = {
    level: 'info',
    time: Date.now(),
    msg: typeof obj === 'string' ? obj : msg || '',
    ...(typeof obj === 'object' ? obj : {}),
  };
  addToLogBuffer(entry);
  return originalInfo(obj, msg, ...args);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
logger.warn = (obj: any, msg?: string, ...args: any[]) => {
  const entry: LogEntry = {
    level: 'warn',
    time: Date.now(),
    msg: typeof obj === 'string' ? obj : msg || '',
    ...(typeof obj === 'object' ? obj : {}),
  };
  addToLogBuffer(entry);
  return originalWarn(obj, msg, ...args);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
logger.error = (obj: any, msg?: string, ...args: any[]) => {
  const entry: LogEntry = {
    level: 'error',
    time: Date.now(),
    msg: typeof obj === 'string' ? obj : msg || '',
    ...(typeof obj === 'object' ? obj : {}),
  };
  addToLogBuffer(entry);
  return originalError(obj, msg, ...args);
};
