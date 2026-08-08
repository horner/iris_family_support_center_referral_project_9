import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const SERVER_PORT = 5178;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // The supervisor's phone must boot the app after an offline reload.
      workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"] },
      manifest: {
        name: "Iris Referral Matching",
        short_name: "Iris",
        description: "DCS referral triage and staff matching for supervisors",
        theme_color: "#1f3a5f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
    }),
  ],
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    port: 5173,
    proxy: {
      "/yorm": { target: `http://localhost:${SERVER_PORT}`, ws: true },
      "/api": { target: `http://localhost:${SERVER_PORT}` },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["vendor/**", "e2e/**"],
  },
});
