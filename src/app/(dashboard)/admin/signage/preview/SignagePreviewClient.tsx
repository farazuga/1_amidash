'use client';

// Usage:
//   <SignagePreviewClient blocks={blocks} previewData={previewData} rotationIntervalMs={10000} />
//
// Renders a 16:9 signage display with two independently-rotating block slots.
// Left slot: blocks with position 'left' or 'both'
// Right slot: blocks with position 'right' or 'both'
// Data auto-refreshes every 30 seconds via router.refresh().

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SignageBlock } from '../actions';
import type { PreviewData } from './actions';
import { QuickStatsBlock } from './blocks/QuickStatsBlock';
import { POHighlightBlock } from './blocks/POHighlightBlock';
import { ProjectsInvoicedBlock } from './blocks/ProjectsInvoicedBlock';
import { RichTextBlock } from './blocks/RichTextBlock';
import { PictureBlock } from './blocks/PictureBlock';

interface Props {
  blocks: SignageBlock[];
  previewData: PreviewData;
  rotationIntervalMs: number;
}

// Clock displayed in the footer — ticks every second
function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hhmm = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dateStr = `${dayName}, ${month}/${day}`;

  return (
    <div className="flex flex-col items-start leading-tight">
      <span className="text-white font-bold" style={{ fontSize: 'clamp(28px, 3.5vw, 52px)' }}>
        {hhmm}
      </span>
      <span className="text-white/80 font-medium" style={{ fontSize: 'clamp(12px, 1.4vw, 22px)' }}>
        {dateStr}
      </span>
    </div>
  );
}

// Renders a single block's content area (no wrapper, no opacity handling)
function BlockContent({
  block,
  previewData,
}: {
  block: SignageBlock;
  previewData: PreviewData;
}) {
  const commonProps = { block, previewData };

  switch (block.block_type) {
    case 'quick-stats':
      return <QuickStatsBlock {...commonProps} />;
    case 'po-highlight':
      return <POHighlightBlock {...commonProps} />;
    case 'projects-invoiced':
      return <ProjectsInvoicedBlock {...commonProps} />;
    case 'rich-text':
      return <RichTextBlock {...commonProps} />;
    case 'picture':
      return <PictureBlock {...commonProps} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Unknown block type: {block.block_type}
        </div>
      );
  }
}

// One panel (left or right): manages block rotation with fade transition
function Panel({
  blocks,
  previewData,
  rotationIntervalMs,
  initialDelay = 0,
}: {
  blocks: SignageBlock[];
  previewData: PreviewData;
  rotationIntervalMs: number;
  initialDelay?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const enabledBlocks = blocks.filter((b) => b.enabled);

  const advance = useCallback(() => {
    if (enabledBlocks.length <= 1) return;
    const next = (currentIndex + 1) % enabledBlocks.length;
    setNextIndex(next);
    setTransitioning(true);

    setTimeout(() => {
      setCurrentIndex(next);
      setNextIndex(null);
      setTransitioning(false);
    }, 700); // matches CSS transition duration
  }, [currentIndex, enabledBlocks.length]);

  useEffect(() => {
    if (enabledBlocks.length <= 1) return;
    // Initial delay so left and right panels alternate transitions
    const delayTimer = setTimeout(() => {
      advance();
    }, initialDelay);
    return () => clearTimeout(delayTimer);
    // Only run once on mount for the initial delay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (enabledBlocks.length <= 1) return;
    const timer = setInterval(advance, rotationIntervalMs);
    return () => clearInterval(timer);
  }, [advance, enabledBlocks.length, rotationIntervalMs]);

  if (enabledBlocks.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col min-w-0 rounded-[40px] overflow-hidden items-center justify-center text-gray-300"
        style={{ border: '8px solid #1B3B2D', fontSize: 'clamp(10px, 1.2vw, 18px)' }}
      >
        No blocks configured
      </div>
    );
  }

  const currentBlock = enabledBlocks[currentIndex];
  const titleToShow =
    nextIndex !== null ? enabledBlocks[nextIndex].title : currentBlock.title;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 rounded-[40px] overflow-hidden"
      style={{ border: '8px solid #1B3B2D' }}
    >
      {/* Title bar */}
      <div
        className="flex items-center flex-shrink-0 px-[clamp(12px,2vw,32px)]"
        style={{
          borderBottom: '3px solid #1B3B2D',
          height: 'clamp(36px, 5vw, 72px)',
        }}
      >
        <span
          className="font-bold truncate transition-all duration-700"
          style={{ fontSize: 'clamp(11px, 1.4vw, 22px)', color: '#1B3B2D' }}
        >
          {titleToShow}
        </span>
      </div>

      {/* Content: cross-fade between current and next block */}
      <div className="relative flex-1 min-h-0">
        {/* Current block — fades out when transitioning */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: transitioning ? 0 : 1,
            padding: 'clamp(8px, 1.2vw, 20px)',
          }}
          aria-hidden={transitioning}
        >
          <BlockContent block={currentBlock} previewData={previewData} />
        </div>

        {/* Incoming block — fades in when transitioning */}
        {nextIndex !== null && (
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: transitioning ? 1 : 0,
              padding: 'clamp(8px, 1.2vw, 20px)',
            }}
            aria-hidden={!transitioning}
          >
            <BlockContent block={enabledBlocks[nextIndex]} previewData={previewData} />
          </div>
        )}
      </div>

      {/* Rotation indicator dots */}
      {enabledBlocks.length > 1 && (
        <div className="flex justify-center gap-1 flex-shrink-0 pb-2">
          {enabledBlocks.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: 'clamp(4px, 0.6vw, 8px)',
                height: 'clamp(4px, 0.6vw, 8px)',
                backgroundColor:
                  i === currentIndex ? '#1B3B2D' : '#D1D5DB',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SignagePreviewClient({ blocks, previewData, rotationIntervalMs }: Props) {
  const router = useRouter();

  // Re-fetch server data every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);

  // Distribute blocks: left-only go left, right-only go right,
  // "both" blocks are dealt out alternately so they don't duplicate
  const leftOnly = blocks.filter((b) => b.position === 'left');
  const rightOnly = blocks.filter((b) => b.position === 'right');
  const bothBlocks = blocks.filter((b) => b.position === 'both');

  const leftFromBoth: SignageBlock[] = [];
  const rightFromBoth: SignageBlock[] = [];
  bothBlocks.forEach((b, i) => {
    if (i % 2 === 0) leftFromBoth.push(b);
    else rightFromBoth.push(b);
  });

  const leftBlocks = [...leftOnly, ...leftFromBoth];
  const rightBlocks = [...rightOnly, ...rightFromBoth];

  return (
    // Full-viewport black surround, centers the 16:9 frame
    <div
      className="fixed inset-0 bg-gray-950 flex items-center justify-center"
      style={{ zIndex: 50 }}
    >
      {/* 16:9 frame — scales to fill viewport while preserving ratio */}
      <div
        className="relative w-full bg-white"
        style={{
          aspectRatio: '16 / 9',
          maxHeight: '100vh',
          maxWidth: 'calc(100vh * 16 / 9)',
        }}
      >
        <div
          className="absolute inset-0 flex flex-col"
          style={{ padding: 'clamp(8px, 1.5vw, 24px)' }}
        >
          {/* Two block panels */}
          <div className="flex flex-1 gap-[clamp(6px,1vw,16px)] min-h-0">
            <Panel
              blocks={leftBlocks}
              previewData={previewData}
              rotationIntervalMs={rotationIntervalMs}
              initialDelay={0}
            />
            <Panel
              blocks={rightBlocks}
              previewData={previewData}
              rotationIntervalMs={rotationIntervalMs}
              initialDelay={Math.round(rotationIntervalMs / 2)}
            />
          </div>

          {/* Footer bar */}
          <div
            className="flex items-center justify-between flex-shrink-0 mt-[clamp(6px,1vw,16px)] rounded-2xl px-[clamp(16px,2.5vw,40px)]"
            style={{
              backgroundColor: '#1B3B2D',
              height: 'clamp(56px, 8vw, 100px)',
            }}
          >
            <Clock />

            {/* Logo with text fallback */}
            <div className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/new_logo.png"
                alt="amitrace"
                className="object-contain"
                style={{
                  height: 'clamp(20px, 3vw, 48px)',
                  maxWidth: 'clamp(80px, 12vw, 180px)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'inline';
                }}
              />
              <span
                className="text-white font-bold hidden"
                style={{
                  fontSize: 'clamp(18px, 2.2vw, 34px)',
                  letterSpacing: '0.04em',
                }}
              >
                amitrace
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
