import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDocsList } from "./AdminDocsList";

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		adminDocs: {
			list: vi.fn(async () => ({
				docs: [
					{
						slug: "how-auth-works",
						path: "src/content/docs/how-auth-works.mdx",
						title: "how-auth-works",
						type: "guide",
					},
					{
						slug: "aeps-cw",
						path: "src/content/docs/endpoints/aeps-cw.md",
						title: "aeps-cw",
						type: "endpoint",
					},
				],
			})),
		},
	},
}));

afterEach(() => vi.clearAllMocks());

describe("AdminDocsList", () => {
	it("renders grouped docs and fires onSelect", async () => {
		const onSelect = vi.fn();
		render(<AdminDocsList selected={null} onSelect={onSelect} />);
		expect(await screen.findByText("how-auth-works")).toBeInTheDocument();
		expect(screen.getByText("Guides")).toBeInTheDocument();
		expect(screen.getByText("Endpoint notes")).toBeInTheDocument();
		fireEvent.click(screen.getByText("aeps-cw"));
		await waitFor(() =>
			expect(onSelect).toHaveBeenCalledWith(
				"src/content/docs/endpoints/aeps-cw.md",
			),
		);
	});
});
