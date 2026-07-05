import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo: pin this app's root so Next never infers it from sibling lockfiles.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: appRoot },
  allowedDevOrigins: [
    "fuel.portal.ec-workshops.online",
    "https://fuel.portal.ec-workshops.online",
    "*.portal.ec-workshops.online",
    "https://*.portal.ec-workshops.online",
    "fuel-portal.ec-workshops.online",
    "https://fuel-portal.ec-workshops.online",
    "http://fuel-portal.ec-workshops.online",
    "*.ec-workshops.online",
    "https://*.ec-workshops.online",
    "http://*.ec-workshops.online",
    "localhost:6600",
    "localhost",
    "http://localhost:6600",
    "https://localhost:6600"
  ],
  experimental: {
    serverActions: {
      // Correction requests carry a signed running-chart photo/PDF.
      bodySizeLimit: "12mb",
      allowedOrigins: [
        "fuel.portal.ec-workshops.online",
        "https://fuel.portal.ec-workshops.online",
        "*.portal.ec-workshops.online",
        "https://*.portal.ec-workshops.online",
        "fuel-portal.ec-workshops.online",
        "https://fuel-portal.ec-workshops.online",
        "http://fuel-portal.ec-workshops.online",
        "*.ec-workshops.online",
        "https://*.ec-workshops.online",
        "http://*.ec-workshops.online",
        "localhost:6600",
        "localhost",
        "http://localhost:6600",
        "https://localhost:6600"
      ],
    },
  },
};

export default nextConfig;

