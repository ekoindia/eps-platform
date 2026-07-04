import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const packageDir = fileURLToPath(new URL(".", import.meta.url));

// Standalone package config so tests do NOT inherit the website's root
// vitest.config.ts (jsdom + react + ./src/test/setup.ts). These are pure
// Node modules using node: APIs.
export default defineConfig(({ mode }) => ({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.ts"],
		// UAT smoke credentials from ./.env (see .env.example). Prefix filter
		// keeps unrelated local vars out of tests; loadEnv gives an inline
		// shell var precedence over the file.
		env: loadEnv(mode, packageDir, "EPS_UAT_"),
	},
}));
