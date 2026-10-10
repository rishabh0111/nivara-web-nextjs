import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // The Widget's face (`src/widget/widget-face.ts`) is fetched from a
        // Tenant's page, which is another origin, and a font is always fetched
        // in CORS mode. Without this the browser drops it and the Widget falls
        // back to the system face on every site but this one.
        source: "/fonts/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
