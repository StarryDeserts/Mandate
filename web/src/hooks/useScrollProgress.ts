"use client";

import { RefObject, useEffect, useState } from "react";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function useScrollProgress<T extends HTMLElement>(ref: RefObject<T>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const total = rect.height + viewport;
      setProgress(clamp01((viewport - rect.top) / total));
    };

    const queue = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [ref]);

  return progress;
}
