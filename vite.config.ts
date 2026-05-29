import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "vite-imagetools";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import path from "path";
import { generateMarkdownPlugin } from "./vite-plugin-generate-markdown";
import { prerenderPlugin } from "./ssg/plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    imagetools(),
    tailwindcss(),
    generateMarkdownPlugin(),
    mode !== "development" && prerenderPlugin(),
    // svgo for svgs + sharp for png/jpg. imagetools emits only avif/webp,
    // so png/jpg here only hits public assets (e.g. the OG preview) and any
    // normally-bundled raster — never imagetools output, so no double-encode.
    ViteImageOptimizer({
      test: /\.(svg|png|jpe?g)$/i,
      png: { quality: 80 },
      jpeg: { quality: 80 },
    }),
  ].filter(Boolean),
  build: {
    cssMinify: "lightningcss",
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-slot',
            '@radix-ui/react-label',
            '@radix-ui/react-collapsible',
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
