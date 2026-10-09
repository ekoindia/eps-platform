import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ALL_ERROR_CODES, AUTH_ERROR_CODES } from "./api-error-codes";

/** The MDX page is hand-written; this keeps its 401 table tied to the data. */
describe("AUTH_ERROR_CODES", () => {
	const mdx = readFileSync(
		resolve(
			dirname(fileURLToPath(import.meta.url)),
			"../../content/docs/error-codes.mdx",
		),
		"utf8",
	);

	it("covers exactly 2483–2487", () => {
		expect(AUTH_ERROR_CODES.map((c) => c.status)).toEqual([
			2483, 2484, 2485, 2486, 2487,
		]);
	});

	it.each(AUTH_ERROR_CODES)("error-codes.mdx lists $status verbatim", (c) => {
		// Cells may be padded by prettier's table alignment.
		const message = c.message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		expect(mdx).toMatch(
			new RegExp(`\\|\\s*\`${c.status}\`\\s*\\|\\s*${message}\\s*\\|`),
		);
	});

	it("flows into ALL_ERROR_CODES (agent bundle errors topic)", () => {
		for (const c of AUTH_ERROR_CODES)
			expect(ALL_ERROR_CODES.find((e) => e.code === c.status)?.meaning).toMatch(
				/^HTTP 401 — /,
			);
	});
});
