'use client';

import { useState } from 'react';
import type { SignageBlock } from '../../actions';
import type { PreviewData } from '../actions';

interface Props {
  block: SignageBlock;
  previewData: PreviewData;
}

export function PictureBlock({ block }: Props) {
  const imageUrl = typeof block.content?.image_url === 'string' ? block.content.image_url : null;
  const [failed, setFailed] = useState(false);

  if (!imageUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No image set
      </div>
    );
  }

  if (failed) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Image failed to load
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={block.title}
        className="w-full h-full"
        style={{ objectFit: 'contain' }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
