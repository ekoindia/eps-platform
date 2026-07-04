import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guards that the local bundle-types stays aligned with the website's source.
// Compares the AgentBundle-specific interface NAMES present in both files.
const here = path.dirname(fileURLToPath(import.meta.url));
const localSrc = readFileSync(path.join(here, "bundle-types.ts"), "utf8");
const siteSrc = readFileSync(
	path.resolve(here, "../../../src/lib/agent/agent-bundle-types.ts"),
	"utf8",
);

const NAMES = [
	"AgentEnvironment",
	"AgentBundleMeta",
	"AgentApiIndexEntry",
	"AgentApiDetail",
	"AgentAuthTopic",
	"AgentErrorsTopic",
	"AgentPricingTopic",
	"AgentEnvironmentsTopic",
	"AgentTopics",
	"AgentBundle",
	"AgentIndex",
];

/** Extract the body of `export interface <name> ... { ... }`, whitespace- and
 * comment-normalized, so field-level drift fails the test (names alone don't). */
const interfaceBody = (src: string, name: string): string => {
	const start = src.indexOf(`interface ${name}`);
	if (start === -1) return `<missing ${name}>`;
	const open = src.indexOf("{", start);
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		if (src[i] === "{") depth++;
		else if (src[i] === "}" && --depth === 0)
			return src
				.slice(open, i + 1)
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\/\/[^\n]*/g, "")
				.replace(/\s+/g, " ")
				.trim();
	}
	return `<unterminated ${name}>`;
};

describe("bundle-types parity", () => {
	it("declares every AgentBundle interface the website declares", () => {
		for (const name of NAMES) {
			expect(localSrc).toContain(`interface ${name}`);
			expect(siteSrc).toContain(`interface ${name}`);
		}
	});

	it("interface bodies match the website's field-for-field", () => {
		for (const name of NAMES)
			expect(interfaceBody(localSrc, name), name).toBe(
				interfaceBody(siteSrc, name),
			);
	});
});
