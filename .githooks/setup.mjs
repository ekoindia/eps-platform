// Wires the committed git hooks (.githooks/) via core.hooksPath.
// Run from package.json `prepare`, so `npm install` activates hooks on every clone.
// Guards: skips in CI, skips when there is no .git (tarball/docker export), and
// never clobbers a pre-existing hooksPath set to something else.
import { execFileSync } from "node:child_process";

// A CI checkout HAS a .git dir, so the no-git guard below does not cover it.
// Runners have no gitleaks, and the pre-commit hook blocks the commit when it
// is missing — which broke release.yml's sdk-split, where the job commits the
// baked SDK surface into its ephemeral checkout before splitting. No human
// authors commits on a runner, and secrets are still scanned in CI by
// .github/workflows/secret-scan.yml.
if (process.env.CI) process.exit(0);

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
