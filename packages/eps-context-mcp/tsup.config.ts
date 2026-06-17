import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node18",
	clean: true,
	// data/eps.json is read at runtime from the package dir (see load-bundle.ts);
	// keep it as a shipped asset (package.json "files"), not bundled.
});
