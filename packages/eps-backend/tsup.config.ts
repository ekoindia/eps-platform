import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node24",
	clean: true,
	sourcemap: true,
	// tsup defaults this to true, rewriting `node:x` → `x`. Prefix-only builtins
	// (`node:sqlite`, `node:test`) have no bare form, so the stripped import
	// crashes the bundle at boot while source-level tests stay green.
	removeNodeProtocol: false,
});
