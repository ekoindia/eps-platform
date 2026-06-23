#!/usr/bin/env node
// Content-hash gated npm release for monorepo packages.
//
// For each package dir given, this:
//   1. bakes + builds the package (so dist/ + data/ reflect current source),
//   2. computes a content fingerprint of the exact files npm would publish
//      (the `npm pack` file set), normalizing package.json's `version` away,
//   3. fetches the currently-published tarball from the registry and fingerprints
//      it the same way,
//   4. publishes a new version ONLY if the fingerprints differ.
//
// Design notes (intentional):
//   * Stateless. The registry is the source of truth — no bot commit back to a
//     protected branch. We only push a git tag `<name>@<version>` for traceability
//     and idempotency. The repo package.json `version` is informational: bump it
//     above the npm latest to force a minor/major; otherwise patches auto-increment.
//   * Publishes with --ignore-scripts after we bake/build here, so the published
//     bytes equal the bytes we fingerprinted (prepublishOnly would rebuild).
//   * Idempotent: a version-conflict on publish (content already on npm from a
//     prior partial run) is treated as success, then we (re)create the tag.
//
// Usage: node scripts/auto-release.mjs <pkgDir> [<pkgDir> ...] [--dry-run]
// Requires (in CI): a prior repo-root `npm run build` (emits dist/agent/*.json),
// `npm ci`, npm auth (OIDC or NODE_AUTH_TOKEN), and the `tar` CLI.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const pkgDirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (pkgDirs.length === 0) {
	console.error("usage: auto-release.mjs <pkgDir> [<pkgDir> ...] [--dry-run]");
	process.exit(2);
}

/** Run a command, returning trimmed stdout; throws on non-zero exit.
 *  With stdio:"inherit" execFileSync returns null — return "" in that case. */
const run = (cmd, args, opts = {}) => {
	const out = execFileSync(cmd, args, { encoding: "utf8", ...opts });
	return out == null ? "" : out.trim();
};

/** Parse "x.y.z" into a comparable tuple; non-semver → null. */
const parseSemver = (v) => {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Return 1 if a>b, -1 if a<b, 0 if equal (both must be valid semver tuples). */
const cmpSemver = (a, b) => {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
	}
	return 0;
};

const patchBump = ([maj, min, pat]) => `${maj}.${min}.${pat + 1}`;

/** sha256 of a buffer/string, hex. */
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * Canonicalize a package.json's bytes for fingerprinting: drop the `version`
 * field (it changes every release and must not count as a content change) and
 * re-serialize with sorted keys so formatting is irrelevant.
 */
const canonPackageJson = (buf) => {
	const obj = JSON.parse(buf.toString("utf8"));
	delete obj.version;
	const sortDeep = (v) =>
		v && typeof v === "object" && !Array.isArray(v)
			? Object.fromEntries(
					Object.keys(v)
						.sort()
						.map((k) => [k, sortDeep(v[k])]),
				)
			: v;
	return JSON.stringify(sortDeep(obj));
};

/** Fingerprint a {relativePath -> Buffer} map into one stable hash. */
const fingerprint = (fileMap) => {
	const h = createHash("sha256");
	for (const rel of Object.keys(fileMap).sort()) {
		const buf = fileMap[rel];
		const content =
			path.basename(rel) === "package.json" ? canonPackageJson(buf) : buf;
		h.update(rel).update("\0").update(sha(content)).update("\n");
	}
	return h.digest("hex");
};

/** Build the published-file set for the freshly built package on disk. */
const localFileMap = async (pkgDir) => {
	const out = run("npm", ["pack", "--dry-run", "--json"], { cwd: pkgDir });
	const files = JSON.parse(out)[0].files.map((f) => f.path);
	const map = {};
	for (const rel of files) {
		map[rel] = await fs.readFile(path.join(pkgDir, rel));
	}
	return map;
};

/** Download + extract the published tarball; return its file map (or null). */
const publishedFileMap = async (name, tarballUrl) => {
	const res = await fetch(tarballUrl);
	if (!res.ok) throw new Error(`download ${name} tarball: HTTP ${res.status}`);
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eps-rel-"));
	const tgz = path.join(tmp, "pkg.tgz");
	await fs.writeFile(tgz, Buffer.from(await res.arrayBuffer()));
	run("tar", ["-xzf", tgz, "-C", tmp]); // npm tarballs extract to package/
	const root = path.join(tmp, "package");
	const map = {};
	const walk = async (dir) => {
		for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
			const abs = path.join(dir, ent.name);
			if (ent.isDirectory()) await walk(abs);
			else map[path.relative(root, abs)] = await fs.readFile(abs);
		}
	};
	await walk(root);
	await fs.rm(tmp, { recursive: true, force: true });
	return map;
};

/** npm view, returning undefined for an unpublished package rather than throwing. */
const npmView = (name, field) => {
	try {
		return run("npm", ["view", `${name}`, field], {
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return undefined; // 404 — never published
	}
};

const ensureTag = (tag) => {
	const exists = (() => {
		try {
			run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]);
			return true;
		} catch {
			return false;
		}
	})();
	if (exists) return false;
	if (DRY_RUN) {
		console.log(`  [dry-run] would create + push tag ${tag}`);
		return true;
	}
	run("git", ["tag", tag]);
	run("git", ["push", "origin", tag]);
	console.log(`  tagged ${tag}`);
	return true;
};

const releaseOne = async (pkgDir) => {
	const pkg = JSON.parse(
		await fs.readFile(path.join(pkgDir, "package.json"), "utf8"),
	);
	const { name } = pkg;
	const localVersion = pkg.version;
	console.log(`\n=== ${name} (${pkgDir}) ===`);

	// 1. Bake + build so the on-disk artifact reflects current source.
	run("npm", ["run", "bake"], { cwd: pkgDir, stdio: "inherit" });
	run("npm", ["run", "build"], { cwd: pkgDir, stdio: "inherit" });

	// 2. Fingerprint local + published content.
	const local = await localFileMap(pkgDir);
	const localPrint = fingerprint(local);

	const npmLatest = npmView(name, "version");
	if (!npmLatest) {
		// First-ever publish: ship the local version as-is.
		console.log(`  not on npm yet → first publish at ${localVersion}`);
		return publish(pkgDir, name, localVersion);
	}

	const tarballUrl = npmView(name, "dist.tarball");
	const published = await publishedFileMap(name, tarballUrl);
	const publishedPrint = fingerprint(published);

	if (localPrint === publishedPrint) {
		console.log(`  no content change vs ${name}@${npmLatest} → skip`);
		ensureTag(`${name}@${npmLatest}`); // backfill tag for current release
		return { name, action: "skip", version: npmLatest };
	}

	// 3. Changed → decide next version.
	//    Honor a manual bump (local > npm latest) for minor/major; else patch.
	const latestT = parseSemver(npmLatest);
	const localT = parseSemver(localVersion);
	let next;
	if (localT && latestT && cmpSemver(localT, latestT) > 0) {
		next = localVersion; // maintainer chose this (minor/major intent)
	} else if (latestT) {
		next = patchBump(latestT);
	} else {
		throw new Error(
			`cannot compute next version from npm latest "${npmLatest}"`,
		);
	}
	console.log(`  content changed → ${name}@${npmLatest} → ${next}`);
	return publish(pkgDir, name, next);
};

const publish = (pkgDir, name, version) => {
	if (DRY_RUN) {
		console.log(`  [dry-run] would set version ${version} + npm publish`);
		ensureTag(`${name}@${version}`);
		return { name, action: "publish", version, dryRun: true };
	}
	run(
		"npm",
		["version", version, "--no-git-tag-version", "--allow-same-version"],
		{
			cwd: pkgDir,
			stdio: "inherit",
		},
	);
	try {
		// We already baked+built; skip lifecycle scripts so published bytes match.
		// --provenance generates a signed SLSA build attestation (needs id-token:
		// write, which the npm-release job grants, and a PUBLIC source repo).
		run(
			"npm",
			["publish", "--access", "public", "--provenance", "--ignore-scripts"],
			{ cwd: pkgDir, stdio: "inherit" },
		);
		console.log(`  published ${name}@${version}`);
	} catch (err) {
		const msg = String(err.stderr || err.message || "");
		if (
			/cannot publish over|previously published|EPUBLISHCONFLICT|403/i.test(msg)
		) {
			console.log(
				`  ${name}@${version} already on npm (idempotent) → continue`,
			);
		} else {
			throw err;
		}
	}
	ensureTag(`${name}@${version}`);
	return { name, action: "publish", version };
};

const main = async () => {
	const results = [];
	for (const dir of pkgDirs) {
		results.push(await releaseOne(path.resolve(dir)));
	}
	console.log(`\n=== summary ===\n${JSON.stringify(results, null, 2)}`);
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
