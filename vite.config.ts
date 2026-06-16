import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { sri } from "vite-plugin-sri3";

export default defineConfig({
  plugins: [react(), tailwindcss(), sri({ algorithm: "sha384" })],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
