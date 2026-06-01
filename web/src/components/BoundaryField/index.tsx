"use client";

import dynamic from "next/dynamic";
import { useFeatureDetect } from "@/hooks/useFeatureDetect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { BoundaryVariant } from "./phase-director";
import StaticFrame from "./StaticFrame";

const BoundaryFieldClient = dynamic(() => import("./BoundaryFieldClient"), {
  ssr: false,
  loading: () => <StaticFrame interactive={false} />
});

export default function BoundaryField({ variant, decorative = true }: { variant: BoundaryVariant; decorative?: boolean }) {
  const ok = useFeatureDetect();
  const reduced = useReducedMotion();

  if (ok !== true || reduced !== false) {
    return <StaticFrame compact={variant === "echo"} interactive={!decorative} />;
  }
  return <BoundaryFieldClient variant={variant} decorative={decorative} />;
}
