#!/usr/bin/env node
// Content-gated version resolver for the SHARED SDK release line.
//
// Every SDK — Node.js, PHP, Python, Go — ships at one version, cut as a single
// `vX.Y.Z` git tag. This decides whether the current commit deserves a new one:
//
//   1. fingerprint every SDK package's git-tracked files (normalizing the
//      version-bearing manifest lines away, since those are rewritten at
//      publish time from the tag) PLUS the baked dist/agent/sdk-surface.json,
//      which is the generated payload all four ship;
//   2. compare against the fingerprint recorded in the newest `vX.Y.Z` tag;
//   3. if they differ, the next version is a patch bump of that tag (floored at
//      VERSION_FLOOR).
//
// Design notes (intentional):
//   * The tag carries its own fingerprint in the annotated message, so this is
//     stateless — no bot commit back to a protected branch, mirroring
//     scripts/auto-release.mjs where the npm registry plays that role. Four
//     registries with one shared version have no single registry to ask.
//   * `plan` never writes. The tag is created by a separate `tag` invocation
//     that runs only AFTER every publish succeeded, so a failed release leaves
//     no fingerprint behind and the next run retries instead of skipping.
//   * The surface is fingerprinted as built output, not as its api-specs.ts
//     inputs: most spec edits (descriptions, samples) never reach the surface,
//     and gating on inputs would cut a release on nearly every docs commit.
//
// Usage:
//   node scripts/sdk-release.mjs plan            → {"version","changed","reason"}
//   node scripts/sdk-release.mjs tag <version>   → create + push the annotated tag
//
// Requires a prior repo-root `npm run build` (emits dist/agent/sdk-surface.json).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Every package on the shared SDK version line. */
const SDK_DIRS = [
	"packages/sdk-js",
	"packages/sdk-php",
	"packages/sdk-python",
	"packages/sdk-go",
	"packages/sdk-java",
];

/** The generated payload every SDK ships a copy of. */
const SURFACE = "dist/agent/sdk-surface.json";

/** No shared tag may be below this. npm's @ekoindia/eps-sdk line reached 0.1.21
 * under the old per-package scheme and versions cannot go backwards, so the
 * unified line starts at 1.0.0. */
const VERSION_FLOOR = "1.0.0";

/** Marker for the fingerprint stored in an annotated tag's message. */
const FINGERPRINT_PREFIX = "sdk-fingerprint:";

const run = (cmd, args, opts = {}) => {
	const out = execFileSync(cmd, args, { encoding: "utf8", ...opts });
	return out == null ? "" : out.trim();
};

const parseSemver = (v) => {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const cmpSemver = (a, b) => {
	for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
	return 0;
};

const patchBump = ([maj, min, pat]) => `${maj}.${min}.${pat + 1}`;

/**
 * Strip the version out of a manifest before hashing. These lines are rewritten
 * from the tag at publish time, so counting them as content would make every
 * release look like a change and cut an endless chain of empty releases.
 */
const canonicalize = (rel, buf) => {
	const base = path.basename(rel);
	if (base === "package.json") {
		const obj = JSON.parse(buf.toString("utf8"));
		delete obj.version;
		return JSON.stringify(obj);
	}
	if (base === "pyproject.toml") {
		return buf.toString("utf8").replace(/^version = .*$/m, "version = <tag>");
	}
	return buf;
};

/** Fingerprint the SDK sources plus the baked surface into one stable hash. */
const currentFingerprint = async () => {
	const files = SDK_DIRS.flatMap((dir) =>
		run("git", ["ls-files", "--", dir]).split("\n").filter(Boolean),
	).sort();
	if (files.length === 0) throw new Error("no SDK files found — wrong cwd?");

	const hash = createHash("sha256");
	for (const rel of files) {
		const content = canonicalize(rel, await fs.readFile(rel));
		hash
			.update(rel)
			.update("\0")
			.update(createHash("sha256").update(content).digest("hex"))
			.update("\n");
	}
	// The surface is gitignored, so it is never in `git ls-files` — add the
	// built artifact explicitly. Its absence means the caller skipped the build.
	let surface;
	try {
		surface = await fs.readFile(SURFACE);
	} catch {
		throw new Error(`${SURFACE} not found — run \`npm run build\` first.`);
	}
	hash
		.update(SURFACE)
		.update("\0")
		.update(createHash("sha256").update(surface).digest("hex"));
	return hash.digest("hex");
};

/** Newest `vX.Y.Z` tag by semver, with the fingerprint from its message. */
const latestTag = () => {
	const tags = run("git", ["tag", "--list", "v*"])
		.split("\n")
		.filter(Boolean)
		.map((name) => ({ name, semver: parseSemver(name.slice(1)) }))
		.filter((t) => t.semver) // ignores prereleases (v1.0.0-rc.1) on purpose
		.sort((a, b) => cmpSemver(b.semver, a.semver));
	if (tags.length === 0) return null;
	const [newest] = tags;
	const message = run("git", [
		"tag",
		"--list",
		"--format=%(contents)",
		newest.name,
	]);
	const match = new RegExp(`${FINGERPRINT_PREFIX}\\s*([0-9a-f]{64})`).exec(
		message,
	);
	return { ...newest, fingerprint: match ? match[1] : null };
};

/** Next version: patch-bump the newest tag, never below the floor. */
const nextVersion = (latest) => {
	const floor = parseSemver(VERSION_FLOOR);
	if (!latest) return VERSION_FLOOR;
	const bumped = parseSemver(patchBump(latest.semver));
	return cmpSemver(bumped, floor) < 0
		? VERSION_FLOOR
		: patchBump(latest.semver);
};

const plan = async () => {
	const fingerprint = await currentFingerprint();
	const latest = latestTag();
	const version = nextVersion(latest);

	if (process.env.SDK_RELEASE_FORCE === "1") {
		return {
			version,
			changed: true,
			fingerprint,
			reason: "forced by SDK_RELEASE_FORCE",
		};
	}
	if (!latest) {
		return {
			version,
			changed: true,
			fingerprint,
			reason: "no previous vX.Y.Z tag",
		};
	}
	if (!latest.fingerprint) {
		// A tag from before this script existed (or a hand-cut one) records no
		// fingerprint, so there is nothing to compare against — release, and the
		// new tag establishes the baseline.
		return {
			version,
			changed: true,
			fingerprint,
			reason: `${latest.name} carries no fingerprint`,
		};
	}
	if (latest.fingerprint !== fingerprint) {
		return {
			version,
			changed: true,
			fingerprint,
			reason: `SDK content changed since ${latest.name}`,
		};
	}
	return {
		version: latest.name.slice(1),
		changed: false,
		fingerprint,
		reason: `no SDK change since ${latest.name}`,
	};
};

const tag = async (version) => {
	if (!parseSemver(version))
		throw new Error(`not a release version: ${version}`);
	const fingerprint = await currentFingerprint();
	const name = `v${version}`;
	run("git", [
		"tag",
		"-a",
		name,
		"-m",
		`Release ${name}\n\n${FINGERPRINT_PREFIX} ${fingerprint}\n`,
	]);
	run("git", ["push", "origin", name]);
	console.log(`tagged ${name} (${FINGERPRINT_PREFIX} ${fingerprint})`);
};

const [command, argument] = process.argv.slice(2);
if (command === "plan") {
	console.log(JSON.stringify(await plan()));
} else if (command === "tag") {
	await tag(argument);
} else {
	console.error("usage: sdk-release.mjs plan | tag <version>");
	process.exit(2);
}
