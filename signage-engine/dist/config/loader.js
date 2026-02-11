import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { validateConfig } from './schema.js';
import { logger } from '../utils/logger.js';
const defaultSlides = [
    { type: 'active-projects', enabled: true, duration: 15000, title: 'Active Projects' },
    { type: 'po-ticker', enabled: true, duration: 10000, title: 'Recent POs' },
    { type: 'revenue-dashboard', enabled: true, duration: 20000, title: 'Revenue' },
    { type: 'team-schedule', enabled: true, duration: 15000, title: 'Schedule' },
];
let currentConfig = {
    ndi: { name: 'Amidash Signage', frameRate: 60 },
    display: { width: 3840, height: 2160, backgroundColor: '#053B2C', accentColor: '#C2E0AD', fontFamily: 'Inter' },
    polling: { projects: 30000, revenue: 60000, schedule: 30000, purchaseOrders: 15000 },
    slides: defaultSlides,
    transitions: { type: 'fade', duration: 500 },
    api: { port: 3001, host: '127.0.0.1' },
    staleData: { warningThresholdMs: 60000, indicatorPosition: 'bottom-right' },
    debug: { enabled: false, showSafeArea: true, showFrameRate: true, showDataTimestamps: true },
};
export function loadConfigFromFile(filePath) {
    const absolutePath = resolve(filePath);
    if (!existsSync(absolutePath)) {
        logger.warn({ path: absolutePath }, 'Config file not found, using defaults');
        return currentConfig;
    }
    try {
        const contents = readFileSync(absolutePath, 'utf-8');
        const parsed = yaml.load(contents);
        const merged = { ...currentConfig, ...parsed, slides: parsed.slides || defaultSlides };
        return validateConfig(merged);
    }
    catch (error) {
        logger.error({ error }, 'Failed to load config');
        return currentConfig;
    }
}
export function getConfig() { return currentConfig; }
export function setConfig(config) { currentConfig = config; }
export function initConfig() {
    const path = process.env.SIGNAGE_CONFIG_PATH || './config/default.yaml';
    currentConfig = loadConfigFromFile(path);
    return currentConfig;
}
export function updateConfig(updates) {
    currentConfig = validateConfig({ ...currentConfig, ...updates });
    return currentConfig;
}
//# sourceMappingURL=loader.js.map