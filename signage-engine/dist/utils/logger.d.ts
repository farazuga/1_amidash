export declare const logger: any;
interface LogEntry {
    level: string;
    time: number;
    msg: string;
}
export declare function addToLogBuffer(entry: LogEntry): void;
export declare function getRecentLogs(count?: number): LogEntry[];
export {};
