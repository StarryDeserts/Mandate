"use client";

import { useEffect, useState } from "react";

export function useFeatureDetect(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { antialias: false });
      const supportsFloat = Boolean(gl?.getExtension("EXT_color_buffer_float"));
      setOk(Boolean(gl && supportsFloat));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return ok;
}
