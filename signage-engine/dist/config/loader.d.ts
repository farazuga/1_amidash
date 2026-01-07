import { SignageConfig } from './schema.js';
export declare function loadConfigFromFile(filePath: string): SignageConfig;
export declare function getConfig(): SignageConfig;
export declare function setConfig(config: SignageConfig): void;
export declare function initConfig(): SignageConfig;
export declare function updateConfig(updates: Partial<SignageConfig>): SignageConfig;
