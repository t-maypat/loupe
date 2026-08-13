// Landing-page scroll behaviour: eased in-page navigation and reveal-on-scroll.
//
// The native `scroll-behavior: smooth` is deliberately not used. Its duration is
// fixed by the browser and reads as a jerk on long jumps, and it also hijacks
// every programmatic scroll in the app. Both helpers here bail out to an instant
// jump under prefers-reduced-motion.

import { useEffect, useRef } from "react";

const NAV_OFFSET = 64;
const MIN_MS = 420;
const MAX_MS = 900;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function scrollToElement(target: Element) {
  const destination = Math.max(
    0,
    target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
  );
  const start = window.scrollY;
  const distance = destination - start;

  if (prefersReducedMotion() || Math.abs(distance) < 2) {
    window.scrollTo(0, destination);
    return;
  }

  // Longer jumps get more time, but within bounds, so a full-page jump never
  // feels slow and a short one never feels abrupt.
  const duration = Math.min(MAX_MS, Math.max(MIN_MS, Math.abs(distance) * 0.5));
  const startedAt = performance.now();
  let cancelled = false;
  let listening = false;

  // A real scroll gesture from the reader wins over the animation. This only
  // counts deliberate input: a wheel event with actual delta, or a touch. It is
  // also attached one frame late, so the click that started the animation can
  // never cancel it.
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY !== 0 || event.deltaX !== 0) cancelled = true;
  };
  const onTouch = () => {
    cancelled = true;
  };

  const stopListening = () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouch);
  };

  const step = (now: number) => {
    if (cancelled) {
      stopListening();
      return;
    }

    const progress = Math.min(1, (now - startedAt) / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));

    if (!listening) {
      listening = true;
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchstart", onTouch, { passive: true });
    }

    if (progress < 1) requestAnimationFrame(step);
    else stopListening();
  };

  requestAnimationFrame(step);
}

/**
 * Eases in-page anchor clicks. Bound to the document in the capture phase, so it
 * does not depend on a ref being attached, on where the link sits in the tree, or
 * on nothing else having stopped the event on the way up. Route links (#/app)
 * pass straight through to the router.
 */
export function useSmoothAnchors() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Let the browser handle modified clicks: new tab, new window, download.
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const path = event.composedPath?.() ?? [];
      let anchor: HTMLAnchorElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
      }
      // composedPath is empty in some synthetic cases, so fall back to closest().
      if (!anchor) {
        const from = event.target;
        anchor = from instanceof Element ? from.closest("a") : null;
      }
      if (!anchor) return;

      const hash = anchor.getAttribute("href") ?? "";
      // Sections only. "#" is a no-op and "#/..." belongs to the router.
      if (!hash.startsWith("#") || hash === "#" || hash.startsWith("#/")) return;

      let target: Element | null = null;
      try {
        target = document.querySelector(hash);
      } catch {
        return; // Not a valid selector, let the browser deal with it.
      }
      if (!target) return;

      event.preventDefault();
      scrollToElement(target);
      window.history.replaceState(null, "", hash);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}

/**
 * Marks an element visible once it scrolls into view, so sections can settle in
 * rather than snapping. Content is revealed immediately when motion is reduced
 * or when IntersectionObserver is unavailable, so nothing can be stranded
 * invisible.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}
