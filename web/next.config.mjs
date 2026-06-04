import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "postprocessing"],
  images: { unoptimized: true },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot
  }
};

export default nextConfig;
