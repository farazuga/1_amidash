import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export type BlockType =
  | 'po-highlight'
  | 'projects-invoiced'
  | 'quick-stats'
  | 'rich-text'
  | 'picture';

export type BlockPosition = 'left' | 'right' | 'both';

export interface SignageBlock {
  id: string;
  block_type: BlockType;
  title: string;
  content: Record<string, unknown>;
  enabled: boolean;
  position: BlockPosition;
  display_order: number;
}

export interface SignageSettings {
  rotation_interval_ms: number;
}

export interface BlocksConfig {
  blocks: SignageBlock[];
  settings: SignageSettings;
}

const DEFAULT_SETTINGS: SignageSettings = {
  rotation_interval_ms: 15000,
};

function getDefaultBlocks(): SignageBlock[] {
  return [
    {
      id: 'default-po-highlight',
      block_type: 'po-highlight',
      title: 'Recent Purchase Orders',
      content: {},
      enabled: true,
      position: 'left',
      display_order: 0,
    },
    {
      id: 'default-projects-invoiced',
      block_type: 'projects-invoiced',
      title: 'Projects Invoiced',
      content: {},
      enabled: true,
      position: 'right',
      display_order: 1,
    },
    {
      id: 'default-quick-stats',
      block_type: 'quick-stats',
      title: 'Quick Stats',
      content: {},
      enabled: true,
      position: 'both',
      display_order: 2,
    },
  ];
}

function getDefaultConfig(): BlocksConfig {
  return {
    blocks: getDefaultBlocks(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

export async function fetchBlocksConfig(): Promise<BlocksConfig> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning default blocks config');
    return getDefaultConfig();
  }

  try {
    const [blocksResult, settingsResult] = await Promise.all([
      supabase
        .from('signage_blocks')
        .select('id, block_type, title, content, enabled, position, display_order')
        .eq('enabled', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('signage_settings')
        .select('rotation_interval_ms')
        .limit(1)
        .single(),
    ]);

    if (blocksResult.error) throw blocksResult.error;

    const blocks: SignageBlock[] = (blocksResult.data || []).map((row) => ({
      id: row.id as string,
      block_type: row.block_type as BlockType,
      title: (row.title as string) || '',
      content: (row.content as Record<string, unknown>) || {},
      enabled: true,
      position: (row.position as BlockPosition) || 'both',
      display_order: (row.display_order as number) || 0,
    }));

    const settings: SignageSettings = settingsResult.error
      ? { ...DEFAULT_SETTINGS }
      : {
          rotation_interval_ms:
            (settingsResult.data?.rotation_interval_ms as number) ||
            DEFAULT_SETTINGS.rotation_interval_ms,
        };

    logger.debug(
      { blockCount: blocks.length, rotationMs: settings.rotation_interval_ms },
      'Fetched blocks config'
    );

    return { blocks, settings };
  } catch (error) {
    logger.error({ error }, 'Failed to fetch blocks config, returning defaults');
    return getDefaultConfig();
  }
}
