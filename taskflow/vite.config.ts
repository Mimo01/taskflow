import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/** Derive version from git tag if not set via env (CI sets APP_VERSION explicitly). */
function gitVersion(): string {
  try {
    const tag = execSync('git describe --tags --match "v[0-9]*" --abbrev=0', { encoding: 'utf8' }).trim();
    return tag.replace(/^v/, '').split('.').concat(['0', '0']).slice(0, 3).join('.');
  } catch {
    return '0.0.0-dev';
  }
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION ?? gitVersion()),
    'import.meta.env.APP_COMMIT_SHA': JSON.stringify(process.env.APP_COMMIT_SHA ?? gitSha()),
    'import.meta.env.APP_BUILD_DATE': JSON.stringify(process.env.APP_BUILD_DATE ?? new Date().toISOString().substring(0, 10)),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
