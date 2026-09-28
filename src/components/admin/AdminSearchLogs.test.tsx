import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authClient, type SearchLogRow } from "@/lib/auth/client";
import { AdminSearchLogs } from "./AdminSearchLogs";

const row = (id: number, query: string): SearchLogRow => ({
	id,
	ts: "2026-09-20T10:00:00.000Z",
	query,
	scope: "all",
	resultCount: 0,
	outcome: "abandon",
	clickedCategory: null,
	clickedRank: null,
	clickedId: null,
	clickedLabel: null,
	page: "/products/dmt-api",
	auth: "developer",
	stage: "kyc-pending",
	trigger: "keyboard",
	device: "desktop",
	refinements: 2,
	durationMs: 4200,
	bodyIndexLoaded: true,
	actionIntent: null,
});

// Real module for its constants (LIFECYCLES); only the network client is faked.
vi.mock("@/lib/auth/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/client")>()),
	authClient: {
		adminSearchLogs: {
			overview: vi.fn(async () => ({
				summary: { total: 4, zeroResult: 1, click: 2, askAi: 1, abandon: 1 },
				top: [{ query: "upi", count: 3 }],
				topFailing: [{ query: "gst verify", count: 1 }],
			})),
			rows: vi.fn(async (_filter: unknown, before?: number) =>
				before
					? { rows: [row(1, "older")], nextBefore: null }
					: { rows: [row(2, "newest")], nextBefore: 2 },
			),
			exportUrl: vi.fn(
				(_filter: unknown, format: string) => `/api/export?format=${format}`,
			),
		},
	},
}));

afterEach(() => vi.clearAllMocks());

describe("AdminSearchLogs", () => {
	it("shows rates as percentages of all searches", async () => {
		render(<AdminSearchLogs />);

		expect(await screen.findByText("50%")).toBeInTheDocument(); // clicked 2/4
		expect(screen.getAllByText("25%")).toHaveLength(3); // no results, abandoned, asked AI
		expect(screen.getByText("Export CSV").closest("a")).toHaveAttribute(
			"href",
			"/api/export?format=csv",
		);
	});

	it("filters the log to a query picked from a top table", async () => {
		render(<AdminSearchLogs />);

		fireEvent.click(await screen.findByText("gst verify"));

		await waitFor(() =>
			expect(authClient.adminSearchLogs.overview).toHaveBeenLastCalledWith(
				expect.objectContaining({ q: "gst verify" }),
			),
		);
	});

	it("appends the next page on Load more, then hides the button", async () => {
		render(<AdminSearchLogs />);

		fireEvent.click(await screen.findByText("Load more"));

		expect(await screen.findByText("older")).toBeInTheDocument();
		expect(screen.getByText("newest")).toBeInTheDocument();
		expect(screen.queryByText("Load more")).not.toBeInTheDocument();
	});

	it("shows page, who and effort; stage filter only for developers", async () => {
		render(<AdminSearchLogs />);

		expect(await screen.findByText("newest")).toBeInTheDocument();
		expect(screen.getByText("/products/dmt-api")).toBeInTheDocument();
		expect(screen.getByText("developer · kyc-pending")).toBeInTheDocument();
		expect(screen.getByText("3 tries · 4.2s")).toBeInTheDocument();

		expect(screen.queryByLabelText("Account stage")).not.toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Who"), {
			target: { value: "developer" },
		});
		expect(screen.getByLabelText("Account stage")).toBeInTheDocument();
	});
});
