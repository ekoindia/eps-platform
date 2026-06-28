import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeployToProduction } from "./DeployToProduction";
import { ApiError } from "@/lib/auth/client";

const production = vi.fn();
vi.mock("@/lib/auth/client", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth/client")>(
			"@/lib/auth/client",
		);
	return {
		...actual,
		authClient: { adminDeploy: { production: () => production() } },
	};
});

afterEach(() => vi.clearAllMocks());

describe("DeployToProduction", () => {
	it("confirms then opens a release PR", async () => {
		production.mockResolvedValue({ prUrl: "https://gh/pr/12", prNumber: 12 });
		render(<DeployToProduction />);
		fireEvent.click(
			screen.getByRole("button", { name: /deploy to production/i }),
		);
		fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
		await waitFor(() => expect(production).toHaveBeenCalled());
		expect(
			await screen.findByRole("link", { name: /release pr #12|view release/i }),
		).toHaveAttribute("href", "https://gh/pr/12");
	});

	it("shows the nothing-to-deploy message", async () => {
		production.mockRejectedValue(
			new ApiError(
				"NOTHING_TO_DEPLOY",
				"dev is already in sync with main",
				409,
			),
		);
		render(<DeployToProduction />);
		fireEvent.click(
			screen.getByRole("button", { name: /deploy to production/i }),
		);
		fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
		expect(await screen.findByText(/in sync/i)).toBeInTheDocument();
	});
});
