import { getBlocks, getSignageSettings } from '../actions';
import { getPreviewData } from './actions';
import { SignagePreviewClient } from './SignagePreviewClient';

export const dynamic = 'force-dynamic';

export default async function SignagePreviewPage() {
  const [blocks, settings, previewData] = await Promise.all([
    getBlocks(),
    getSignageSettings(),
    getPreviewData(),
  ]);

  const rotationIntervalMs = settings?.rotation_interval_ms ?? 10000;

  return (
    <SignagePreviewClient
      blocks={blocks}
      previewData={previewData}
      rotationIntervalMs={rotationIntervalMs}
    />
  );
}
