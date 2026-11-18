declare const process: { env: Record<string, string | undefined> };
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  define: { "import.meta.env.VITE_VERCEL_HOSTED": JSON.stringify(process.env.VERCEL === "1" ? "true" : "false") },
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  build: { chunkSizeWarningLimit: 1600 },
  server: { allowedHosts: true },
});
