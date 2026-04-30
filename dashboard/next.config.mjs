/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";
const backendBaseUrl = process.env.BACKEND_BASE_URL ?? "http://127.0.0.1:3000";

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
              destination: `${backendBaseUrl}/probes/:path*`,
              basePath: false,
            },
            {
              source: "/api/stories/:path*",
              destination: `${backendBaseUrl}/stories/:path*`,
              basePath: false,
            },
            {
              source: "/api/:path*",
              destination: `${backendBaseUrl}/api/:path*`,
              basePath: false,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
