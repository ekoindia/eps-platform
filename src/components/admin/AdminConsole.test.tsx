import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth/client";
import { AdminConsole } from "./AdminConsole";

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		adminDocs: { list: vi.fn(async () => ({ docs: [] })) },
		adminSearchLogs: {
			overview: vi.fn(async () => ({
				summary: { total: 0, zeroResult: 0, click: 0, askAi: 0, abandon: 0 },
				top: [],
				topFailing: [],
			})),
			rows: vi.fn(async () => ({ rows: [], nextBefore: null })),
			exportUrl: vi.fn(() => "/api/export"),
		},
	},
}));

afterEach(() => vi.clearAllMocks());

describe("AdminConsole", () => {
	// Regression: the demo admin has no GitHub token, /admin/docs answers 401
	// NO_GH_TOKEN, and the client reads any 401 as an expired session.
	it("never calls the docs API for an admin without GitHub", async () => {
		render(<AdminConsole canEditDocs={false} />);

		await waitFor(() =>
			expect(authClient.adminSearchLogs.overview).toHaveBeenCalled(),
		);
		expect(authClient.adminDocs.list).not.toHaveBeenCalled();
	});

	it("opens on docs for a GitHub admin", async () => {
		render(<AdminConsole canEditDocs />);

		await waitFor(() => expect(authClient.adminDocs.list).toHaveBeenCalled());
		expect(screen.getByText("Select a doc to edit.")).toBeInTheDocument();
		expect(authClient.adminSearchLogs.overview).not.toHaveBeenCalled();
	});
});
