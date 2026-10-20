import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor mínimo en .next/standalone para la imagen de Docker.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Habilita forbidden() para responder 403 cuando falta un permiso.
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
