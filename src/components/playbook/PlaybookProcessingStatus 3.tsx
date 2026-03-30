/**
 * PLAYBOOK PROCESSING STATUS
 *
 * A polished loading indicator for the playbook analysis process.
 * Features rotating status messages with smooth transitions.
 * Uses ZAP icon with neon orange glow animation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../ui/utils';
import { Zap } from 'lucide-react';

interface PlaybookProcessingStatusProps {
  /** Whether processing is complete */
  isComplete?: boolean;
  /** Callback when fade-out animation completes */
  onFadeOutComplete?: () => void;
  className?: string;
}

const PROCESSING_STAGES = [
  { id: 'understanding', text: 'Understanding your source material...' },
  { id: 'filtering', text: 'Filtering signal from noise...' },
  { id: 'structuring', text: 'Structuring a clean learning flow...' },
  { id: 'assembling', text: 'Assembling your training album...' },
  { id: 'finalizing', text: 'Finalizing tracks and ordering...' },
];

const CYCLE_DURATION = 11000; // 11 seconds per stage

export function PlaybookProcessingStatus({
  isComplete = false,
  onFadeOutComplete,
  className,
}: PlaybookProcessingStatusProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const announcedRef = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Handle completion - fade out quickly
  useEffect(() => {
    if (isComplete && !isFadingOut) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        onFadeOutComplete?.();
      }, 200); // 200ms fade out
      return () => clearTimeout(timer);
    }
  }, [isComplete, isFadingOut, onFadeOutComplete]);

  // Cycle through stages
  useEffect(() => {
    if (isComplete || prefersReducedMotion) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentStageIndex((prev) => (prev + 1) % PROCESSING_STAGES.length);
        setIsTransitioning(false);
      }, 300); // Transition duration
    }, CYCLE_DURATION);

    return () => clearInterval(interval);
  }, [isComplete, prefersReducedMotion]);

  const currentStage = PROCESSING_STAGES[currentStageIndex];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center transition-opacity',
        isFadingOut ? 'opacity-0 duration-200' : 'opacity-100 duration-300',
        className
      )}
      role="status"
      aria-live={announcedRef.current ? 'off' : 'polite'}
      aria-busy="true"
    >
      {/* Main processing pill - large, centered, glass effect */}
      <div
        className={cn(
          'relative flex items-center gap-4 px-8 py-5 rounded-2xl',
          'border border-[#F64A05]/30',
          // Glass effect
          'bg-[#1a1a2e]/80 backdrop-blur-xl',
          // Orange glow
          'shadow-[0_0_30px_rgba(246,74,5,0.25)]',
          // Fixed height to prevent layout shift
          'min-h-[80px]'
        )}
      >
        {/* Gradient border accent */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl opacity-40',
            'bg-gradient-to-r from-[#F64A05]/30 via-transparent to-[#FF733C]/30'
          )}
        />

        {/* Animated ZAP indicator with neon orange glow */}
        <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
          {prefersReducedMotion ? (
            <Zap className="h-8 w-8 text-[#F64A05]" />
          ) : (
            <ZapIndicator />
          )}
        </div>

        {/* Text content with transition - larger font */}
        <div
          className={cn(
            'relative min-w-[300px] transition-all duration-300',
            isTransitioning && !prefersReducedMotion
              ? 'opacity-0 translate-y-1'
              : 'opacity-100 translate-y-0'
          )}
        >
          <span className="text-xl font-medium text-white whitespace-nowrap">
            {currentStage.text}
          </span>
        </div>
      </div>

      {/* Screen reader announcement (once) */}
      {!announcedRef.current && (
        <span className="sr-only" ref={() => { announcedRef.current = true; }}>
          Analyzing document. {currentStage.text}
        </span>
      )}
    </div>
  );
}

/**
 * Animated Zap indicator with neon orange glow effect
 */
function ZapIndicator() {
  return (
    <div className="relative">
      {/* Glow background */}
      <div
        className={cn(
          'absolute inset-0 rounded-full',
          'bg-[#F64A05]/40 blur-lg',
          'animate-pulse'
        )}
        style={{
          width: '48px',
          height: '48px',
          left: '-4px',
          top: '-4px',
        }}
      />

      {/* Zap icon with glow */}
      <Zap
        className={cn(
          'h-8 w-8 text-[#F64A05] relative z-10',
          'drop-shadow-[0_0_8px_rgba(246,74,5,0.8)]',
          'animate-pulse'
        )}
      />
    </div>
  );
}

export default PlaybookProcessingStatus;
