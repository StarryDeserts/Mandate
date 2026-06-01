"use client";

import { useEffect } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (!entry.isIntersecting || node.dataset.counted === "true") continue;
          node.dataset.counted = "true";
          const target = Number(node.dataset.count ?? "0");
          const suffix = node.dataset.countSuffix ?? "";
          const decimals = Number(node.dataset.countDecimals ?? "2");
          const start = performance.now();
          const duration = 1200;

          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            node.textContent = `${(target * easeOutCubic(t)).toFixed(decimals)}${suffix}`;
            if (t < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.35 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
