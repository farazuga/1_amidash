import pino from 'pino';
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
const logBuffer = [];
const LOG_BUFFER_SIZE = 100;
export function addToLogBuffer(entry) {
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE)
        logBuffer.shift();
}
export function getRecentLogs(count = 50) {
    return logBuffer.slice(-count);
}
//# sourceMappingURL=logger.js.map