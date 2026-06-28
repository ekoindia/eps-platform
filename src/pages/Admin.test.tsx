import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import Admin from "@/pages/Admin";

describe("Admin", () => {
	it("renders a GitHub sign-in link to the backend OAuth start", () => {
		render(
			<HelmetProvider>
				<Admin />
			</HelmetProvider>,
		);
		const link = screen.getByRole("link", { name: /sign in with github/i });
		expect(link).toHaveAttribute("href", "/api/auth/admin/github");
	});
});
