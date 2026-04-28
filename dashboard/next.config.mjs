/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  output: "export",
  basePath: "/dashboard",
  assetPrefix: "/dashboard",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/probes/:path*",
              destination: "http://127.0.0.1:3000/probes/:path*",
              basePath: false,
            },
            {
              source: "/api/stories/:path*",
              destination: "http://127.0.0.1:3000/stories/:path*",
              basePath: false,
            },
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:3000/api/:path*",
              basePath: false,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
