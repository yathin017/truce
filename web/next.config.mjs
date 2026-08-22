/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the dev server isolated from `next build`. Otherwise a production build run while
  // local development is open can replace chunks underneath the dev server and make pages return
  // 500 errors such as "Cannot find module './495.js'" until the cache is manually cleared.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
