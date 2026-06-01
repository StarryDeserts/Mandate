/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "postprocessing"],
  images: { unoptimized: true }
};

export default nextConfig;
