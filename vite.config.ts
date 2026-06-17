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
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom", "react-router-dom"],
					"vendor-radix": [
						"@radix-ui/react-accordion",
						"@radix-ui/react-dialog",
						"@radix-ui/react-dropdown-menu",
						"@radix-ui/react-tabs",
						"@radix-ui/react-tooltip",
						"@radix-ui/react-toast",
						"@radix-ui/react-popover",
						"@radix-ui/react-select",
						"@radix-ui/react-navigation-menu",
						"@radix-ui/react-slot",
						"@radix-ui/react-label",
						"@radix-ui/react-collapsible",
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
