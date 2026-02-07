import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
// Vite options tailored for Tauri development and only applied in `tauri dev`
// or `tauri build`
export default defineConfig(async () => ({
  // prevent Vite from obscuring rust errors
  clearScreen: false,

  plugins: [solid()],
  // tauri expects a fixed port, fail if that port is not available
  server: {
    hmr: host
      ? {
          host,
          port: 1421,
          protocol: "ws",
        }
      : undefined,
    host: host || false,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
