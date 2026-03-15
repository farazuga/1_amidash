'use client';

import type { SignageBlock } from '../../actions';
import type { PreviewData } from '../actions';

interface Props {
  block: SignageBlock;
  previewData: PreviewData;
}

interface RichTextItem {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

export function RichTextBlock({ block }: Props) {
  const rawBody = block.content?.body;
  const body: RichTextItem[] = Array.isArray(rawBody) ? (rawBody as RichTextItem[]) : [];

  if (body.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No content
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col gap-[clamp(4px,0.5vw,8px)]">
      {body.map((item, i) => {
        const text = stripMarkdown(item.text || '');

        switch (item.type) {
          case 'heading':
            return (
              <h3
                key={i}
                className="font-bold leading-snug"
                style={{
                  fontSize: 'clamp(12px, 1.5vw, 22px)',
                  color: '#1B3B2D',
                  marginTop: i > 0 ? 'clamp(4px, 0.6vw, 10px)' : 0,
                }}
              >
                {text}
              </h3>
            );

          case 'paragraph':
            return (
              <p
                key={i}
                className="leading-snug"
                style={{
                  fontSize: 'clamp(9px, 1.05vw, 16px)',
                  color: '#374151',
                }}
              >
                {text}
              </p>
            );

          case 'bullet':
            return (
              <div key={i} className="flex items-start gap-[clamp(4px,0.6vw,10px)]">
                <span
                  className="flex-shrink-0 rounded-full mt-[0.35em]"
                  style={{
                    width: 'clamp(4px, 0.6vw, 8px)',
                    height: 'clamp(4px, 0.6vw, 8px)',
                    backgroundColor: '#9CA3AF',
                  }}
                />
                <span
                  className="leading-snug"
                  style={{
                    fontSize: 'clamp(9px, 1.05vw, 16px)',
                    color: '#374151',
                  }}
                >
                  {text}
                </span>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
