import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(__dirname, "../../..");

/**
 * Vite DEV configuration for HMR mode
 * Proxies API routes to Python server at localhost:5000
 */
export default defineConfig({
  define: {
    'globalThis.__JAC_API_BASE_URL__': '""',
  },
  plugins: [react()],
  root: buildDir,
  publicDir: false,
  appType: 'spa',
  build: {
    sourcemap: true, // Enable source maps for better error messages
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      "/walker": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/function": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/user": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/introspect": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/static": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@jac/runtime": path.resolve(buildDir, "compiled/client_runtime.js"),
      "@jac-client/assets": path.resolve(buildDir, "compiled/assets"),
    },
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
});
