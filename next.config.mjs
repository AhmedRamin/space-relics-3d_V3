/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The catalogue and textures are static files fetched at runtime, so the app can be
  // exported to plain HTML/JS for any host (Vercel serves the standard build too).
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
