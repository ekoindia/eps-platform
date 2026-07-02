import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Sync-ack gate for the four utils hand-copied/adapted from sibling packages
 * (they publish separately, so a shared src module is not an option). This is
 * NOT a parity check: it pins a content hash of BOTH sides of each pair and
 * fails when either changes, forcing a human to diff the pair, port whatever
 * applies, and re-ack by pasting the new hash printed in the failure.
 *
 * Monorepo-only by design: CI and release run from full checkouts, and the
 * published tarball excludes tests (files: ["dist","data"]).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

/** BOM + CRLF normalization so hashes don't trip on platform noise. */
const normalize = (raw: string): string =>
	raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

const shaOf = (repoRelative: string): string =>
	createHash("sha256")
		.update(normalize(readFileSync(path.join(repoRoot, repoRelative), "utf8")))
		.digest("hex");

interface Pin {
	local: string;
	localSha: string;
	source: string;
	sourceSha: string;
}

const PINS: Pin[] = [
	{
		local: "packages/eps-transact-mcp/src/fetchTimeout.ts",
		localSha:
			"249ed7367a5ad9dca179b155f7b84961e7266d9e6abcee2a340127deea1516bc",
		source: "packages/eps-backend/src/clients/http.ts",
		sourceSha:
			"0327d83e0dcf107d4a8cff6493992e984ae97bd7b63bd5d2f1f6426b97492cfe",
	},
	{
		local: "packages/eps-transact-mcp/src/requestId.ts",
		localSha:
			"077e778124dc07c034d97eeae99a4e4ff31e5a1d23ffa659d15363d1747d9160",
		source: "packages/eps-backend/src/http/requestId.ts",
		sourceSha:
			"2003db6a01453753367761fad62da7fe5d6846b52b31e8eaeb4c2d4d63ad2e06",
	},
	{
		local: "packages/eps-transact-mcp/src/accessLog.ts",
		localSha:
			"a6c03291dc236d0fa3be1a2f246c424cf643daec022f635fef6ff904d7d5ad3e",
		source: "packages/eps-backend/src/audit/accessLog.ts",
		sourceSha:
			"2a153deeb2deaf56b8c4b16094a8a27062cb452acffd7ddeda1e3f88148332f2",
	},
	{
		local: "packages/eps-transact-mcp/src/update-check.ts",
		localSha:
			"b630902e890e54f98ad2f9f92869416faaa90606c525f8dfa68194ea5e559571",
		source: "packages/eps-context-mcp/src/update-check.ts",
		sourceSha:
			"799e206d59b315b5d08db23f19fecc7b33f971a397dba1f44b3bbd3254885a6e",
	},
];

const reAck = (changed: string, counterpart: string, actual: string): string =>
	`${changed} changed since the last sync review. Diff it against ` +
	`${counterpart}, port anything relevant, then re-ack by replacing its ` +
	`pinned hash in parity.copied-utils.test.ts with:\n${actual}`;

describe("copied-utils sync-ack pins", () => {
	for (const pin of PINS) {
		describe(`${path.basename(pin.local)} ↔ ${pin.source}`, () => {
			it("both files still exist (moves/renames must update the pin)", () => {
				expect(existsSync(path.join(repoRoot, pin.local)), pin.local).toBe(
					true,
				);
				expect(existsSync(path.join(repoRoot, pin.source)), pin.source).toBe(
					true,
				);
			});

			it("upstream is unchanged since the last sync review", () => {
				const actual = shaOf(pin.source);
				expect(actual, reAck(pin.source, pin.local, actual)).toBe(
					pin.sourceSha,
				);
			});

			it("local copy is unchanged since the last sync review", () => {
				const actual = shaOf(pin.local);
				expect(actual, reAck(pin.local, pin.source, actual)).toBe(pin.localSha);
			});
		});
	}

	// The one pair that must stay truly identical: compare the declarations
	// fetchTimeout.ts copies, not the whole upstream file (http.ts is backend
	// app code and may legitimately grow unrelated exports).
	it("fetchTimeout declarations match eps-backend's byte-for-byte", () => {
		const declaration = (repoRelative: string, marker: string): string => {
			const src = normalize(
				readFileSync(path.join(repoRoot, repoRelative), "utf8"),
			);
			const start = src.indexOf(marker);
			expect(start, `${marker} missing in ${repoRelative}`).toBeGreaterThan(-1);
			const end = src.indexOf("\n}", start);
			return src.slice(start, end === -1 ? src.indexOf("\n", start) : end + 2);
		};
		for (const marker of [
			"export const DEFAULT_FETCH_TIMEOUT_MS",
			"export function withTimeout(",
		]) {
			expect(
				declaration("packages/eps-transact-mcp/src/fetchTimeout.ts", marker),
			).toBe(declaration("packages/eps-backend/src/clients/http.ts", marker));
		}
	});
});
