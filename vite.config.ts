declare const process: { env: Record<string, string | undefined> };
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "./",
  build: { chunkSizeWarningLimit: 1600 },
  server: { allowedHosts: true },
});
