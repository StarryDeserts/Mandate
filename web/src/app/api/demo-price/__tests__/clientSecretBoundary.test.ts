import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoots = ["src/app/live", "src/components", "src/lib/mandate"];
const sourceExtensions = new Set([".ts", ".tsx"]);

describe("price signer secret boundary", () => {
  it("keeps PRICE_SIGNER_KEY out of browser-facing source", () => {
    const files = clientRoots.flatMap((root) => sourceFiles(join(process.cwd(), root)));

    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toContain("PRICE_SIGNER_KEY");
    }
  });
});

function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if ([...sourceExtensions].some((extension) => path.endsWith(extension))) return [path];
    return [];
  });
}
