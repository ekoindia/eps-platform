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

describe("bundle-types parity", () => {
	it("declares every AgentBundle interface the website declares", () => {
		for (const name of NAMES) {
			expect(localSrc).toContain(`interface ${name}`);
			expect(siteSrc).toContain(`interface ${name}`);
		}
	});
});
