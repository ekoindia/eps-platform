// src/components/Footer.auth.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/features", () => ({ SHOW_USER_LOGIN: true }));

import { Footer } from "@/components/Footer";

function renderFooter() {
	return render(
		<MemoryRouter>
			<Footer />
		</MemoryRouter>,
	);
}

describe("Footer console entry", () => {
	// The label used to switch on the auth state ("Open Console" / "Log into
	// Console"). It is deliberately one label now — /console handles logging an
	// anonymous visitor in — so the footer reads no auth state at all.
	it("links to the console with one label, whatever the auth state", () => {
		renderFooter();
		expect(
			screen.getByRole("link", { name: "Developer Console" }),
		).toHaveAttribute("href", "/console");
	});
});
