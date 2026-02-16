import tailwindcss from "@tailwindcss/vite";
import { type UserConfig, defineConfig } from "vite";
import solid from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;

/**
 * https://vite.dev/config/
 * Vite options tailored for Tauri development and only applied in `tauri dev`
 * or `tauri build`
 */
export default defineConfig(() => {
  const config: UserConfig = {
    // Prevent Vite from obscuring rust errors
    clearScreen: false,

    plugins: [solid(), tailwindcss()],
    // Tauri expects a fixed port, fail if that port is not available
    server: {
      host: host || false,
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };

  if (host && config.server) {
    config.server.hmr = {
      host,
      port: 1421,
      protocol: "ws",
    };
  }

  return config;
});
