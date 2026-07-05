import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo: pin this app's root so Next never infers it from sibling lockfiles.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: appRoot },
  /* config options here */
};

export default nextConfig;
