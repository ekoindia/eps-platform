import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node18",
	dts: true,
	clean: true,
	// data/sdk-surface.json is read at runtime from the package dir (see
	// client.ts); keep it a shipped asset (package.json "files"), not bundled.
});
