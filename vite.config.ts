import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "vite-imagetools";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import path from "path";
import { mdxOptions } from "./ssg/mdx-options";
import { generateMarkdownPlugin } from "./vite-plugin-generate-markdown";
import { generateOpenApiPlugin } from "./vite-plugin-generate-openapi";
import { generateAgentBundlePlugin } from "./vite-plugin-generate-agent-bundle";
import { generatePricingXlsxPlugin } from "./vite-plugin-generate-xlsx";
import { prerenderPlugin } from "./ssg/plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	server: {
		host: "::",
		port: 8080,
		hmr: {
			overlay: false,
		},
		// Dev-only: proxy /api → eps-backend so cookies are same-origin in dev.
		proxy: {
			"/api": {
				target: process.env.VITE_DEV_BACKEND_ORIGIN ?? "http://localhost:8787",
				changeOrigin: true,
				rewrite: (p) => p.replace(/^\/api/, ""),
			},
		},
	},
	plugins: [
		// MDX must transform `.mdx` → JS before the React plugin runs.
		{ enforce: "pre", ...mdx(mdxOptions) },
		react(),
		imagetools(),
		tailwindcss(),
		generateMarkdownPlugin(),
		generateOpenApiPlugin(),
		generateAgentBundlePlugin(),
		generatePricingXlsxPlugin(),
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
		// Pin the JS output target to match tsconfig.app (ES2020) so bundle output
		// is predictable rather than dependent on Rolldown's evolving default. Bump
		// only alongside a documented browser-support decision.
		target: "es2020",
		rollupOptions: {
			output: {
				// Rolldown (Vite 8) requires manualChunks to be a function, not an object
				manualChunks(id) {
					if (
						id.includes("/react/") ||
						id.includes("/react-dom/") ||
						id.includes("/react-router-dom/")
					) {
						return "vendor-react";
					}
					if (id.includes("/@radix-ui/")) {
						return "vendor-radix";
					}
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
