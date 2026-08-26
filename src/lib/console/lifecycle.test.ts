import { lifecycleBadge } from "@/lib/console/lifecycle";
import type { Lifecycle } from "@/lib/auth/client";
import { describe, expect, it } from "vitest";

describe("lifecycleBadge", () => {
	it("labels the states the console can be in", () => {
		expect(lifecycleBadge("active").label).toBe("Active");
		expect(lifecycleBadge("kyc-pending").label).toBe("KYC Pending");
		expect(lifecycleBadge("lead").label).toBe("Lead");
		expect(lifecycleBadge("inactive").label).toBe("Inactive");
	});

	// The one red pill. A refused KYC pack reading "Active" is what this state
	// exists to stop, and reading it in the same grey as every other state
	// would only half-fix that.
	it("marks a rejected KYC in red", () => {
		expect(lifecycleBadge("kyc-rejected")).toEqual({
			label: "KYC Rejected",
			variant: "destructive",
		});
	});

	it("keeps every other state neutral", () => {
		for (const state of ["active", "kyc-pending", "lead", "inactive"] as const) {
			expect(lifecycleBadge(state).variant).toBe("secondary");
		}
	});

	// The console white-screened on this map's copy when `state` fell outside it.
	// A lifecycle added upstream must degrade, not take the page down.
	it("falls back to Pending for a lifecycle it doesn't know", () => {
		expect(lifecycleBadge("retired" as Lifecycle)).toEqual({
			label: "Pending",
			variant: "secondary",
		});
	});
});
