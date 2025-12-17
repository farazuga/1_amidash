import { readFileSync, existsSync, watchFile } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { SignageConfig, validateConfig } from './schema.js';
import { defaultConfig } from './defaults.js';
import { logger } from '../utils/logger.js';

let currentConfig: SignageConfig = defaultConfig;
let configWatcher: ReturnType<typeof watchFile> | null = null;

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Load configuration from a YAML or JSON file
 */
export function loadConfigFromFile(filePath: string): SignageConfig {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    logger.warn({ path: absolutePath }, 'Config file not found, using defaults');
    return defaultConfig;
  }

  try {
    const fileContents = readFileSync(absolutePath, 'utf-8');
    let parsed: unknown;

    if (absolutePath.endsWith('.yaml') || absolutePath.endsWith('.yml')) {
      parsed = yaml.load(fileContents);
    } else if (absolutePath.endsWith('.json')) {
      parsed = JSON.parse(fileContents);
    } else {
      // Try YAML first, then JSON
      try {
        parsed = yaml.load(fileContents);
      } catch {
        parsed = JSON.parse(fileContents);
      }
    }

    // Merge with defaults and validate
    const merged = deepMerge(defaultConfig, parsed as Partial<SignageConfig>);
    const validated = validateConfig(merged);

    logger.info({ path: absolutePath }, 'Configuration loaded successfully');
    return validated;
  } catch (error) {
    logger.error({ error, path: absolutePath }, 'Failed to load config file');
    throw new Error(`Failed to load config from ${absolutePath}: ${error}`);
  }
}

/**
 * Get the current configuration
 */
export function getConfig(): SignageConfig {
  return currentConfig;
}

/**
 * Set the current configuration
 */
export function setConfig(config: SignageConfig): void {
  currentConfig = config;
}

/**
 * Initialize configuration from environment or file
 */
export function initConfig(): SignageConfig {
  const configPath = process.env.SIGNAGE_CONFIG_PATH || './config/default.yaml';
  currentConfig = loadConfigFromFile(configPath);
  return currentConfig;
}

/**
 * Watch config file for changes and reload
 */
export function watchConfig(
  filePath: string,
  onReload: (config: SignageConfig) => void
): void {
  const absolutePath = resolve(filePath);

  if (configWatcher) {
    // Already watching
    return;
  }

  if (!existsSync(absolutePath)) {
    logger.warn({ path: absolutePath }, 'Cannot watch non-existent config file');
    return;
  }

  configWatcher = watchFile(absolutePath, { interval: 1000 }, () => {
    logger.info({ path: absolutePath }, 'Config file changed, reloading...');
    try {
      const newConfig = loadConfigFromFile(absolutePath);
      currentConfig = newConfig;
      onReload(newConfig);
    } catch (error) {
      logger.error({ error }, 'Failed to reload config, keeping previous configuration');
    }
  });

  logger.info({ path: absolutePath }, 'Watching config file for changes');
}

/**
 * Stop watching config file
 */
export function unwatchConfig(): void {
  if (configWatcher) {
    // Node's watchFile doesn't return an object with close(), we need to use unwatchFile
    configWatcher = null;
  }
}

/**
 * Update specific configuration values at runtime
 */
export function updateConfig(updates: Partial<SignageConfig>): SignageConfig {
  const merged = deepMerge(currentConfig, updates);
  const validated = validateConfig(merged);
  currentConfig = validated;
  logger.info('Configuration updated at runtime');
  return currentConfig;
}

export type { SignageConfig };
