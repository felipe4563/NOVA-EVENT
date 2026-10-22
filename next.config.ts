import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor mínimo en .next/standalone para la imagen de Docker.
  output: "standalone",
  cacheComponents: true,
  // Fuentes del PDF de la propuesta: se leen del disco, hay que copiarlas a la imagen standalone.
  outputFileTracingIncludes: {
    "/panel/cotizaciones/\\[id\\]/pdf": ["./src/assets/fonts/**/*"],
    "/p/\\[token\\]/pdf": ["./src/assets/fonts/**/*"],
  },
  partialPrefetching: true,
  experimental: {
    // Habilita forbidden() para responder 403 cuando falta un permiso.
    authInterrupts: true,
    // Archivos que se suben con una Server Action: logos de la empresa (máx. 5 MB)
    // y comprobantes de pago (máx. 10 MB, más los demás campos del formulario).
    serverActions: { bodySizeLimit: "11mb" },
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
