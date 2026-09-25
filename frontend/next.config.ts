import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://chain-sleuth-backend.onrender.com/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
