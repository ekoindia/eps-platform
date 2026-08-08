import { lifecycleBadge } from "@/lib/console/lifecycle";
import type { Lifecycle } from "@/lib/auth/client";
import { describe, expect, it } from "vitest";

describe("lifecycleBadge", () => {
	it("labels the states the console can be in", () => {
		expect(lifecycleBadge("active")).toBe("Active");
		expect(lifecycleBadge("kyc-pending")).toBe("KYC Pending");
		expect(lifecycleBadge("lead")).toBe("Lead");
		expect(lifecycleBadge("inactive")).toBe("Inactive");
	});

	// The console white-screened on this map's copy when `state` fell outside it.
	// A lifecycle added upstream must degrade, not take the page down.
	it("falls back to Pending for a lifecycle it doesn't know", () => {
		expect(lifecycleBadge("retired" as Lifecycle)).toBe("Pending");
	});
});
