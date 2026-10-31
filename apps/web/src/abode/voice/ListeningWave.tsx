import { useEffect, useRef } from "react";

import { waveHeights } from "./voiceLevel";

/** About 20 updates a second: lively enough to read as "hearing you", cheap on the GPU. */
const FRAME_MS = 50;
const BAR_COUNT = waveHeights(0).length;

/**
 * Bars that follow the mic's loudness while recording. Heights are written straight to the
 * DOM from the recorder's level, so React never re-renders per frame; it only runs while
 * mounted (recording), and holds still for users who ask for reduced motion.
 */
export function ListeningWave({ level }: { level: () => number }) {
  const barsRef = useRef<HTMLSpanElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- interval that writes the mic level into the bar elements' transforms while mounted
  useEffect(() => {
    const bars = barsRef.current?.children;
    if (!bars) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const heights = waveHeights(level());
      for (let index = 0; index < bars.length; index++) {
        (bars[index] as HTMLElement).style.transform = `scaleY(${heights[index]})`;
      }
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [level]);
  return (
    <span ref={barsRef} aria-hidden className="flex h-4 shrink-0 items-center gap-0.75">
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          className="h-full w-0.75 rounded-full bg-primary transition-transform duration-75 ease-out"
          style={{ transform: `scaleY(${waveHeights(0)[index]})` }}
        />
      ))}
    </span>
  );
}
