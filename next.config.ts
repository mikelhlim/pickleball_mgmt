import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (including Server Actions) from
  // other devices on the same network, e.g. http://192.168.1.37:3000.
  allowedDevOrigins: ["192.168.1.37"],
};

export default nextConfig;
