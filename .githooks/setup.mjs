// Wires the committed git hooks (.githooks/) via core.hooksPath.
// Run from package.json `prepare`, so `npm install` activates hooks on every clone.
// Guards: skips when no .git (tarball/docker export/CI), and never clobbers a
// pre-existing hooksPath set to something else.
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();

try {
	git("rev-parse", "--git-dir");
} catch {
	// No git repo here (installed as tarball, exported source, some CI). Nothing to wire.
	process.exit(0);
}

let current = "";
try {
	current = git("config", "--local", "core.hooksPath");
} catch {
	// unset — expected on first install
}

if (current && current !== ".githooks") {
	console.warn(
		`[githooks] core.hooksPath already set to "${current}" — leaving it. ` +
			"Run `git config core.hooksPath .githooks` to enable the gitleaks pre-commit scan.",
	);
	process.exit(0);
}

git("config", "core.hooksPath", ".githooks");
