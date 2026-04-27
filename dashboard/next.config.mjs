/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/dashboard",
  assetPrefix: "/dashboard",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
