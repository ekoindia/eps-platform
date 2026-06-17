import { defineConfig } from "vitest/config";

// Standalone package config so tests do NOT inherit the website's root
// vitest.config.ts (jsdom + react + ./src/test/setup.ts). These are pure
// Node modules using top-level await and node: APIs.
export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.ts"],
	},
});
