import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nova Event",
    short_name: "Nova Event",
    description: "Sistema de gestión de eventos de Nova Event",
    lang: "es",
    start_url: "/panel",
    display: "standalone",
    background_color: "#fbf6f3",
    theme_color: "#7a2944",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
