import { redactIdentifiers as siteRedact } from "@/lib/analytics";
import { describe, expect, it } from "vitest";
import { redactIdentifiers as backendRedact } from "../../packages/eps-backend/src/audit/redact";

// Parity pin: the backend re-redacts sampled ⌘K queries with its own copy of
// the pattern list. If either copy changes alone, this fails.
const SAMPLES = [
	"Send to 9876543210",
	"aadhaar 1234 5678 9012 check",
	"call 98765-43210",
	"verify pan abcde1234f now",
	"mail me at a.b@example.com",
	"key 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d failing",
	"bank-account-verification",
	"earn on 500 DMT of 20000 avg",
	"Step 2 of 5 (491)",
];

describe("redactIdentifiers parity (site vs eps-backend)", () => {
	it.each(SAMPLES)("%s", (sample) => {
		expect(backendRedact(sample)).toBe(siteRedact(sample));
	});
});
