// Pixel-grid loader for long-running work, adapted from the Beautiful UI
// "Loading State" primitive. A chevron wavefront drives right across a 3x3
// grid; because the cycle is shorter than the sweep, two fronts are always in
// flight. Paired with a shimmering label and a live elapsed timer.
//
// Reduced motion freezes the grid to its dim state. The timer still ticks,
// since that is information rather than decoration.

import { useEffect, useState } from "react";

const CHEVRON = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return (col + Math.abs(row - 1)) * 90;
});

const CYCLE_MS = 650;

function useElapsed(): string {
  const [tenths, setTenths] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTenths((t) => t + 1), 100);
    return () => clearInterval(timer);
  }, []);

  const seconds = tenths / 10;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
}

export function PixelLoader({ label = "Working" }: { label?: string }) {
  const elapsed = useElapsed();

  return (
    <span className="pixel-loader">
      <span className="pixel-grid" aria-hidden>
        {CHEVRON.map((delay, i) => (
          <span
            key={i}
            className="pixel-cell"
            style={{ animationDelay: `${delay}ms`, animationDuration: `${CYCLE_MS}ms` }}
          />
        ))}
      </span>
      <span className="pixel-label">{label}</span>
      <span className="pixel-elapsed">{elapsed}</span>
    </span>
  );
}
