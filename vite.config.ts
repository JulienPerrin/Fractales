import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "reload-on-html-and-public",
      handleHotUpdate({ file, server }) {
        if (file.endsWith(".html") || file.includes("/public/")) {
          server.ws.send({ type: "full-reload" });
          return [];
        }
      },
    },
  ],
  server: {
    port: 5175,
  },
  preview: {
    port: 5175,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        mandelbrot: resolve(import.meta.dirname, "Mandelbrot.html"),
        mandelbrotGpu: resolve(import.meta.dirname, "Mandelbrot_with_gpu.html"),
        sierpinski: resolve(import.meta.dirname, "SierPinski.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
