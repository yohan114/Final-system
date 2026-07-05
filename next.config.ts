import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "portal.ec-workshops.online",
    "https://portal.ec-workshops.online",
    "http://portal.ec-workshops.online",
    "*.ec-workshops.online",
    "https://*.ec-workshops.online",
    "http://*.ec-workshops.online",
    "localhost",
    "localhost:6600",
    "http://localhost:6600",
    "https://localhost:6600",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "portal.ec-workshops.online",
        "https://portal.ec-workshops.online",
        "http://portal.ec-workshops.online",
        "*.ec-workshops.online",
        "https://*.ec-workshops.online",
        "http://*.ec-workshops.online",
        "localhost",
        "localhost:6600",
        "http://localhost:6600",
        "https://localhost:6600",
      ],
    },
  },
};

export default nextConfig;
