import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: true, port: 8080 },
  preview: { host: true, port: 8080 },
});
