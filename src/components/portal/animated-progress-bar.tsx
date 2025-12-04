'use client';

import { useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Status } from '@/types';

interface AnimatedProgressBarProps {
  currentStatus: Status | null;
  statuses: Status[];
  isOnHold: boolean;
}

// Animated particle that flows along the progress bar
function FlowingParticle({ delay, duration }: { delay: number; duration: number }) {
  return (
    <motion.div
      className="absolute h-2 w-2 rounded-full bg-white/80 shadow-lg shadow-white/50"
      initial={{ left: '0%', opacity: 0 }}
      animate={{
        left: ['0%', '100%'],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    />
  );
}

// Pulsing ring animation for current status
function PulsingRing({ color }: { color: string }) {
  return (
    <>
      <motion.div
        className={cn('absolute inset-0 rounded-full', color)}
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      <motion.div
        className={cn('absolute inset-0 rounded-full', color)}
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
          delay: 0.5,
        }}
      />
    </>
  );
}

// Arrow indicator pointing to next status
function NextStatusArrow() {
  return (
    <motion.div
      className="absolute -top-6 left-1/2 -translate-x-1/2"
      initial={{ y: -5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.6,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
      }}
    >
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
        <path
          d="M10 12L0 0H20L10 12Z"
          fill="#023A2D"
          className="drop-shadow-lg"
        />
      </svg>
    </motion.div>
  );
}

// Helper for client-side only rendering
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function AnimatedProgressBar({
  currentStatus,
  statuses,
  isOnHold,
}: AnimatedProgressBarProps) {
  const mounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  // Filter out Hold status for the progress display
  const progressStatuses = statuses.filter((s) => s.name !== 'Hold');

  const currentIndex = currentStatus
    ? progressStatuses.findIndex((s) => s.id === currentStatus.id)
    : -1;

  const nextIndex = currentIndex >= 0 && currentIndex < progressStatuses.length - 1
    ? currentIndex + 1
    : -1;

  // Calculate progress percentage
  const isComplete = currentStatus?.name === 'Invoiced';
  const progressPercent = isComplete
    ? 100
    : currentIndex >= 0
    ? Math.round(((currentIndex + 1) / progressStatuses.length) * 100)
    : 0;

  const primaryColor = isOnHold ? 'bg-orange-500' : 'bg-[#023A2D]';
  const primaryColorRing = isOnHold ? 'bg-orange-500/50' : 'bg-[#023A2D]/50';

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          {/* Animated gradient background */}
          <motion.div
            className={cn(
              'h-full rounded-full relative overflow-hidden',
              primaryColor
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            {/* Flowing particles */}
            {!isComplete && progressPercent > 10 && (
              <>
                <FlowingParticle delay={0} duration={3} />
                <FlowingParticle delay={1} duration={3} />
                <FlowingParticle delay={2} duration={3} />
              </>
            )}
          </motion.div>
        </div>

        {/* Progress percentage */}
        <motion.div
          className="absolute right-0 top-6 text-sm font-semibold text-[#023A2D]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {progressPercent}% Complete
        </motion.div>
      </div>

      {/* Status steps */}
      <div className="relative mt-10 pt-2">
        {/* Connection line */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full" />

        {/* Animated progress line */}
        <motion.div
          className={cn('absolute top-5 left-0 h-1 rounded-full', primaryColor)}
          initial={{ width: 0 }}
          animate={{
            width: currentIndex >= 0
              ? `${((currentIndex + 0.5) / (progressStatuses.length - 1)) * 100}%`
              : '0%',
          }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        <div className="relative flex justify-between">
          {progressStatuses.map((status, index) => {
            const isCompleted = currentStatus
              ? status.display_order < currentStatus.display_order ||
                (status.id === currentStatus.id && status.name === 'Invoiced')
              : false;
            const isCurrent = status.id === currentStatus?.id;
            const isNext = index === nextIndex;

            return (
              <motion.div
                key={status.id}
                className="flex flex-col items-center relative"
                style={{ width: `${100 / progressStatuses.length}%` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                {/* Next status arrow indicator */}
                <AnimatePresence>
                  {isNext && !isOnHold && <NextStatusArrow />}
                </AnimatePresence>

                {/* Status dot */}
                <div className="relative">
                  {/* Pulsing rings for current status */}
                  {isCurrent && !isComplete && (
                    <PulsingRing color={primaryColorRing} />
                  )}

                  {/* Glowing effect for next status */}
                  {isNext && !isOnHold && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-[#023A2D]/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0.2, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}

                  <motion.div
                    className={cn(
                      'w-8 h-8 rounded-full border-3 z-10 flex items-center justify-center relative',
                      isCompleted
                        ? 'bg-[#023A2D] border-[#023A2D]'
                        : isCurrent
                        ? isOnHold
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-[#023A2D] border-[#023A2D]'
                        : isNext
                        ? 'bg-white border-[#023A2D] border-2'
                        : 'bg-white border-gray-300 border-2'
                    )}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    {/* Checkmark for completed */}
                    {isCompleted && (
                      <motion.svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        <motion.path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5 }}
                        />
                      </motion.svg>
                    )}

                    {/* Current status indicator */}
                    {isCurrent && !isCompleted && (
                      <motion.div
                        className="w-3 h-3 rounded-full bg-white"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}

                    {/* Next status dot */}
                    {isNext && !isOnHold && (
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#023A2D]"
                        animate={{ scale: [0.8, 1.2, 0.8] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Status label */}
                <motion.span
                  className={cn(
                    'text-xs mt-3 text-center px-1 font-medium',
                    isCurrent
                      ? 'text-[#023A2D] font-bold'
                      : isCompleted
                      ? 'text-[#023A2D]'
                      : isNext
                      ? 'text-[#023A2D]/70'
                      : 'text-gray-400'
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                >
                  {status.name}
                  {isCurrent && (
                    <motion.span
                      className="block text-[10px] text-[#023A2D]/60 mt-0.5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      Current
                    </motion.span>
                  )}
                  {isNext && !isOnHold && (
                    <motion.span
                      className="block text-[10px] text-[#023A2D]/60 mt-0.5"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Up Next
                    </motion.span>
                  )}
                </motion.span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* On Hold indicator */}
      <AnimatePresence>
        {isOnHold && (
          <motion.div
            className="flex items-center justify-center gap-2 mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <motion.div
              className="w-3 h-3 rounded-full bg-orange-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm font-medium text-orange-700">
              Project is currently on hold
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            className="flex items-center justify-center gap-2 mt-4 p-3 bg-green-50 rounded-lg border border-green-200"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.span>
            <span className="text-sm font-medium text-green-700">
              Project Complete!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
