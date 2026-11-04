import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/auth/client";
import {
	CRM_NONE_TTL_MS,
	CRM_TTL_MS,
	crmLeadSnapshot,
	resetCrmLeadCache,
	startCrmLead,
	updateCrmLead,
} from "./lead-store";

const { crmLead, updateCrmLeadApi } = vi.hoisted(() => ({
	crmLead: vi.fn(),
	updateCrmLeadApi: vi.fn(),
}));
vi.mock("@/lib/auth/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth/client")>();
	return {
		...actual,
		authClient: {
			...actual.authClient,
			crmLead,
			updateCrmLead: updateCrmLeadApi,
		},
	};
});

const KEY = "eps.crm.lead";
const OWNER = "6710000002";
const LEAD = "5545974000000317001";
const VIEW = {
	id: LEAD,
	fields: { Industry: "NGO", City: "Pune", utm_source: null },
	picklists: { Industry: ["NGO", "Others"] },
};

/** Lets the store's fetch promise settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function stored() {
	const raw = localStorage.getItem(KEY);
	return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-03T09:00:00Z"));
	localStorage.clear();
	resetCrmLeadCache();
	crmLead.mockReset();
	updateCrmLeadApi.mockReset();
	crmLead.mockResolvedValue(VIEW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("startCrmLead", () => {
	it("makes no request when the profile links no Lead", () => {
		startCrmLead(OWNER, null);
		expect(crmLeadSnapshot()).toEqual({ status: "none" });
		expect(crmLead).not.toHaveBeenCalled();
	});

	it("fetches, then parks the Lead tagged with owner and Lead id", async () => {
		startCrmLead(OWNER, LEAD);
		expect(crmLeadSnapshot()).toEqual({ status: "loading" });
		await settle();
		expect(crmLeadSnapshot()).toEqual({
			status: "ok",
			fields: VIEW.fields,
			picklists: VIEW.picklists,
		});
		expect(stored()).toMatchObject({ owner: OWNER, leadId: LEAD });
	});

	it("is idempotent for the same partner", async () => {
		startCrmLead(OWNER, LEAD);
		startCrmLead(OWNER, LEAD);
		await settle();
		startCrmLead(OWNER, LEAD);
		expect(crmLead).toHaveBeenCalledTimes(1);
	});

	// The point of the cache: a reload — or a new tab — costs no Zoho read.
	it("serves a fresh cached Lead without a request", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		resetMemoryOnly();
		startCrmLead(OWNER, LEAD);
		expect(crmLeadSnapshot()).toMatchObject({ status: "ok" });
		expect(crmLead).toHaveBeenCalledTimes(1);
	});

	it("refetches once the day is up", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		resetMemoryOnly();
		vi.setSystemTime(Date.now() + CRM_TTL_MS + 1);
		startCrmLead(OWNER, LEAD);
		expect(crmLead).toHaveBeenCalledTimes(2);
	});

	it("never serves another partner's cached Lead", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		startCrmLead("9990000001", "1111111111");
		expect(crmLeadSnapshot()).toEqual({ status: "loading" });
		expect(crmLead).toHaveBeenCalledTimes(2);
	});

	it("caches a 404 as 'no CRM data' for an hour, not a day", async () => {
		crmLead.mockRejectedValue(new ApiError("CRM_DISABLED", "off", 404));
		startCrmLead(OWNER, LEAD);
		await settle();
		expect(crmLeadSnapshot()).toEqual({ status: "none" });

		resetMemoryOnly();
		startCrmLead(OWNER, LEAD);
		expect(crmLead).toHaveBeenCalledTimes(1);

		resetMemoryOnly();
		vi.setSystemTime(Date.now() + CRM_NONE_TTL_MS + 1);
		startCrmLead(OWNER, LEAD);
		expect(crmLead).toHaveBeenCalledTimes(2);
	});

	it("does not cache a failure, and retries on the next start", async () => {
		crmLead.mockRejectedValueOnce(new ApiError("CRM_UNAVAILABLE", "down", 502));
		startCrmLead(OWNER, LEAD);
		await settle();
		expect(crmLeadSnapshot()).toEqual({ status: "error" });
		expect(stored()).toBeNull();

		startCrmLead(OWNER, LEAD);
		await settle();
		expect(crmLeadSnapshot()).toMatchObject({ status: "ok" });
	});

	it("discards a malformed or older-version blob", async () => {
		localStorage.setItem(
			KEY,
			JSON.stringify({ v: 0, owner: OWNER, leadId: LEAD }),
		);
		startCrmLead(OWNER, LEAD);
		expect(crmLead).toHaveBeenCalledTimes(1);
	});
});

describe("updateCrmLead", () => {
	it("patches only the changed fields, in memory and on disk", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		const fetchedAt = stored().fetchedAt;
		updateCrmLeadApi.mockResolvedValue({
			id: LEAD,
			updated: { City: "Mumbai" },
		});

		vi.setSystemTime(Date.now() + 60_000);
		await updateCrmLead({ City: "Mumbai" });

		expect(updateCrmLeadApi).toHaveBeenCalledWith({ City: "Mumbai" });
		expect(crmLeadSnapshot()).toMatchObject({
			status: "ok",
			fields: { Industry: "NGO", City: "Mumbai", utm_source: null },
		});
		expect(stored().result.fields.City).toBe("Mumbai");
		// A patch is not a fresh read: the day still runs from the last fetch.
		expect(stored().fetchedAt).toBe(fetchedAt);
		expect(crmLead).toHaveBeenCalledTimes(1);
	});

	it("leaves the cache untouched when the write fails", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		updateCrmLeadApi.mockRejectedValue(
			new ApiError("FIELD_ALREADY_SET", "locked", 409),
		);
		await expect(updateCrmLead({ utm_source: "google" })).rejects.toThrow();
		expect(crmLeadSnapshot()).toMatchObject({
			fields: { utm_source: null },
		});
	});
});

describe("resetCrmLeadCache", () => {
	it("clears memory and storage", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		resetCrmLeadCache();
		expect(crmLeadSnapshot()).toEqual({ status: "idle" });
		expect(stored()).toBeNull();
	});

	// A sign-out mid-fetch must not let the old partner's Lead land afterwards.
	it("drops a response that arrives after the session ended", async () => {
		startCrmLead(OWNER, LEAD);
		resetCrmLeadCache();
		await settle();
		expect(crmLeadSnapshot()).toEqual({ status: "idle" });
		expect(stored()).toBeNull();
	});
});

describe("cross-tab sync", () => {
	it("adopts another tab's save for the same partner", async () => {
		startCrmLead(OWNER, LEAD);
		await settle();
		const { subscribeCrmLead } = await import("./lead-store");
		const unsubscribe = subscribeCrmLead(() => {});
		const other = { ...stored() };
		other.result = {
			...other.result,
			fields: { ...other.result.fields, City: "Delhi" },
		};
		window.dispatchEvent(
			new StorageEvent("storage", {
				key: KEY,
				newValue: JSON.stringify(other),
			}),
		);
		expect(crmLeadSnapshot()).toMatchObject({ fields: { City: "Delhi" } });
		unsubscribe();
	});
});

/**
 * Forgets the in-memory Lead but keeps localStorage — what a page reload does.
 * `resetCrmLeadCache` clears storage too, so it is saved and restored here.
 */
function resetMemoryOnly() {
	const raw = localStorage.getItem(KEY);
	resetCrmLeadCache();
	if (raw) localStorage.setItem(KEY, raw);
}
