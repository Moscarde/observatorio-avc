import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Pré-otimiza a dependência oficial também no modo de desenvolvimento.
  optimizeDeps: { include: ["echarts"] },
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
  build: { chunkSizeWarningLimit: 1200 },
});
