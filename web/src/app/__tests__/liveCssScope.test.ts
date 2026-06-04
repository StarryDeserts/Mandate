import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../globals.css", import.meta.url)), "utf8");

describe("live console CSS scope", () => {
  it("keeps calmer live styling scoped to live selectors", () => {
    expect(css).toContain(".live-console {");
    expect(css).toContain("background: #080d0c;");
    expect(css).toContain(".live-next-step");
    expect(css).toContain(".live-result-summaries");
    expect(css).toContain(".live-activity__item--blocked");
    expect(css).toContain(".live-debug-panel__details");

    const liveSelectorLines = css.split("\n").filter((line) => line.includes(".live-") || line.includes(".live_"));
    expect(liveSelectorLines.some((line) => line.includes(".hero") || line.includes(".final-cta"))).toBe(false);
  });
});
