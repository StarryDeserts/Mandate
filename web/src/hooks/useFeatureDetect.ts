"use client";

import { useEffect, useState } from "react";

export function useFeatureDetect(): boolean {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false });
    const supportsFloat = Boolean(gl?.getExtension("EXT_color_buffer_float"));
    setOk(Boolean(gl && supportsFloat));
  }, []);

  return ok;
}
