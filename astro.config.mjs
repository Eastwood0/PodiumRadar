// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [react()],
  // Inline the small stylesheet: one request less before the first paint (Lighthouse "render-blocking").
  build: { inlineStylesheets: "always" },
  vite: { plugins: [tailwindcss()] },
});
