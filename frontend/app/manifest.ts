import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVA — Adaptive Virtual Agent",
    short_name: "AVA",
    description: "AGI-level personal assistant command interface",
    start_url: "/chat",
    display: "standalone",
    background_color: "#000000", // Match your dark mode background
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
