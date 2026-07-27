import {
	buildRoleTransactionList,
	loadWalletInteractionId,
} from "@/lib/connect/interactions";
import { describe, expect, it } from "vitest";

/**
 * Trimmed from a real `/connect/interactions` response. The shape that matters:
 * every composite interaction reports `interaction_type_id: 0` and carries its
 * real id in `id`, with children in `group_interaction_ids`.
 */
const LOAD_EVALUE = {
	id: 491,
	interaction_type_id: 0,
	behavior: 7,
	group_interaction_ids: "315,92,773,324,240,263",
	label: "Load E-value",
	is_visible: "0",
};

const REQUEST_EVALUE = {
	id: 240,
	interaction_type_id: 0,
	behavior: 6,
	group_interaction_ids: "22,371,468,44,1025",
	label: "Request E-value",
	is_visible: "0",
};

/** A leaf interaction: real type, id unrelated to it. */
const BANK_STATUS = {
	id: 1025,
	interaction_type_id: 335,
	behavior: 1,
	label: "Bank Status",
};

describe("buildRoleTransactionList", () => {
	it("keys by `id`, not `interaction_type_id`", () => {
		const list = buildRoleTransactionList([LOAD_EVALUE]);

		expect(list["491"]).toBeDefined();
		// The type is 0 here; keying by it would be the bug.
		expect(list["0"]).toBeUndefined();
	});

	it("does not collapse composites that share interaction_type_id 0", () => {
		const list = buildRoleTransactionList([LOAD_EVALUE, REQUEST_EVALUE]);

		expect(Object.keys(list).sort()).toEqual(["240", "491"]);
	});

	it("keys a leaf interaction by its id, not its type", () => {
		const list = buildRoleTransactionList([BANK_STATUS]);

		expect(list["1025"]).toBeDefined();
		expect(list["335"]).toBeUndefined();
	});

	it("passes the row through whole, keeping grid children", () => {
		const list = buildRoleTransactionList([LOAD_EVALUE]);

		// 491 is behavior 7 — a grid. Dropping group_interaction_ids renders empty.
		expect(list["491"]).toEqual(LOAD_EVALUE);
	});

	it("skips rows with no usable id", () => {
		const list = buildRoleTransactionList([
			{ label: "orphan" },
			{ id: "", label: "blank" },
			LOAD_EVALUE,
		]);

		expect(Object.keys(list)).toEqual(["491"]);
	});

	it("lets the last duplicate win", () => {
		// 7775 legitimately arrives twice upstream.
		const list = buildRoleTransactionList([
			{ id: 7775, label: "first" },
			{ id: 7775, label: "second" },
		]);

		expect(list["7775"]).toMatchObject({ label: "second" });
	});
});

describe("loadWalletInteractionId", () => {
	it("prefers the retailer flow when both are entitled", () => {
		const list = buildRoleTransactionList([REQUEST_EVALUE, LOAD_EVALUE]);

		expect(loadWalletInteractionId(list)).toBe(491);
	});

	it("falls back to the distributor flow", () => {
		const list = buildRoleTransactionList([REQUEST_EVALUE]);

		expect(loadWalletInteractionId(list)).toBe(240);
	});

	it("finds the flow even when upstream marks it not visible", () => {
		// Both real rows carry is_visible "0"; entitlement is presence in the list,
		// which is how Eloka reads it too.
		const list = buildRoleTransactionList([LOAD_EVALUE]);

		expect(loadWalletInteractionId(list)).toBe(491);
	});

	it("returns null when the user may not load E-value", () => {
		const list = buildRoleTransactionList([BANK_STATUS]);

		expect(loadWalletInteractionId(list)).toBeNull();
	});
});
