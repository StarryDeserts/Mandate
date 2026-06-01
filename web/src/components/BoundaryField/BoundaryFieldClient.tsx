"use client";

import { useEffect, useRef, useState } from "react";
import BlockedStamp from "./BlockedStamp";
import { BoundaryFieldRenderer } from "./renderer";
import type { BoundaryPhase, BoundaryVariant } from "./phase-director";

const mobileQuery = "(max-width: 640px)";

export default function BoundaryFieldClient({ variant }: { variant: BoundaryVariant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoundaryFieldRenderer | null>(null);
  const [phase, setPhase] = useState<BoundaryPhase>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const mobile = window.matchMedia(mobileQuery).matches;
    const renderer = new BoundaryFieldRenderer();
    rendererRef.current = renderer;
    renderer.init(canvas, {
      variant,
      particleGrid: mobile ? 64 : 180,
      bloom: !mobile,
      dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2),
      onPhaseChange: setPhase
    });

    let raf = 0;
    let last = performance.now();
    let visible = true;
    let documentVisible = !document.hidden;
    let perfSamples = 0;
    let perfTotal = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    };

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (visible && documentVisible) {
        renderer.frame(now, dt);
        if (!mobile && perfSamples < 30) {
          perfSamples += 1;
          perfTotal += dt;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    intersectionObserver.observe(container);

    const onVisibility = () => {
      documentVisible = !document.hidden;
      last = performance.now();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = -(((event.clientY - rect.top) / rect.height - 0.5) * 2);
      renderer.setPointer(x * 0.5, y * 0.5);
    };

    const onClick = () => renderer.pulseClick();
    const onFreeze = (event: Event) => {
      const detail = (event as CustomEvent<{ phase: BoundaryPhase | null }>).detail;
      renderer.setFreezePhase(detail?.phase ?? null);
    };
    const onScrollBias = () => {
      const rect = container.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      renderer.setScrollProgress(progress);
    };

    document.addEventListener("visibilitychange", onVisibility);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("click", onClick);
    window.addEventListener("mandate-boundary-freeze", onFreeze as EventListener);
    window.addEventListener("scroll", onScrollBias, { passive: true });
    onScrollBias();
    raf = requestAnimationFrame(tick);

    const perfTimer = window.setTimeout(() => {
      if (!mobile && perfSamples > 0 && perfTotal / perfSamples > 22) {
        container.classList.add("boundary-field--low-perf");
      }
    }, 900);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(perfTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("click", onClick);
      window.removeEventListener("mandate-boundary-freeze", onFreeze as EventListener);
      window.removeEventListener("scroll", onScrollBias);
      renderer.dispose(canvas);
      rendererRef.current = null;
    };
  }, [variant]);

  const showStamp = phase === 2 || phase === 3;

  return (
    <div className={`boundary-field boundary-field--${variant}`}>
      <canvas ref={canvasRef} className="boundary-field__canvas" aria-hidden="true" />
      <div className={`boundary-field__stamp ${showStamp ? "is-visible" : ""}`}>
        <BlockedStamp compact={variant === "echo"} />
      </div>
    </div>
  );
}
