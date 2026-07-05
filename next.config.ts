import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo: pin this app's root so Next never infers it from sibling lockfiles.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: appRoot },
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
