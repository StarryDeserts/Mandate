"use client";

import dynamic from "next/dynamic";
import { useFeatureDetect } from "@/hooks/useFeatureDetect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { BoundaryVariant } from "./phase-director";
import StaticFrame from "./StaticFrame";

const BoundaryFieldClient = dynamic(() => import("./BoundaryFieldClient"), {
  ssr: false,
  loading: () => <StaticFrame />
});

export default function BoundaryField({ variant }: { variant: BoundaryVariant }) {
  const ok = useFeatureDetect();
  const reduced = useReducedMotion();

  if (!ok || reduced) return <StaticFrame compact={variant === "echo"} />;
  return <BoundaryFieldClient variant={variant} />;
}
