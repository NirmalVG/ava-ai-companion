import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVA — Adaptive Virtual Agent",
    short_name: "AVA",
    description: "AGI-level personal assistant command interface",
    lang: "en-US",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["productivity", "utilities"],
    shortcuts: [
      {
        name: "Open Chat",
        short_name: "Chat",
        url: "/chat",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Open Memory",
        short_name: "Memory",
        url: "/memory",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
