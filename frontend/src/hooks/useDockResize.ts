// Drag-to-resize for the composer dock.
//
// Height is null until the user drags, so the dock keeps its natural content
// height by default and only becomes a fixed box once they ask for one. The
// clamp is re-applied on window resize, so a dock sized on a tall window cannot
// end up taller than a short one.
//
// Below the stacking breakpoint the workspace scrolls as one column and a fixed
// dock height makes no sense, so the stylesheet overrides the inline height and
// the handle is hidden.

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_HEIGHT = 148;
const MAX_FRACTION = 0.6;
const KEY_STEP = 16;

export function useDockResize() {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const maxHeight = useCallback(
    () => Math.max(MIN_HEIGHT, Math.round(window.innerHeight * MAX_FRACTION)),
    []
  );

  const clamp = useCallback(
    (value: number) => Math.min(maxHeight(), Math.max(MIN_HEIGHT, value)),
    [maxHeight]
  );

  // A dock sized on one viewport should not survive unclamped into a smaller one.
  useEffect(() => {
    const onResize = () => setHeight((h) => (h === null ? h : clamp(h)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const dock = dockRef.current;
    if (!dock || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startHeight: dock.offsetHeight };
    document.body.classList.add("is-resizing");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Dragging up grows the dock, which is why the delta is subtracted.
    setHeight(clamp(drag.startHeight - (event.clientY - drag.startY)));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove("is-resizing");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const dock = dockRef.current;
    if (!dock) return;
    const current = height ?? dock.offsetHeight;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHeight(clamp(current + KEY_STEP));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHeight(clamp(current - KEY_STEP));
    } else if (event.key === "Escape") {
      setHeight(null);
    }
  };

  // Double click restores the natural height.
  const reset = () => setHeight(null);

  useEffect(() => () => document.body.classList.remove("is-resizing"), []);

  return {
    dockRef,
    dockStyle: height === null ? undefined : { height },
    handleProps: {
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      "aria-label": "Resize the question box",
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
      onDoubleClick: reset,
    },
  };
}
