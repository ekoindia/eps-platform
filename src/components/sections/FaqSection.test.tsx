import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FaqAccordion, type FaqItem } from "./FaqSection";

/**
 * FAQ answers are authored in markdown. These guard the render contract:
 * formatting is parsed (not shown literally), internal links stay in the SPA,
 * external links are safely targeted, and block content never lands inside a
 * `<p>` — which would be invalid HTML and break hydration on prerendered pages.
 */
const renderFaqs = (faqs: FaqItem[]) =>
	render(
		<MemoryRouter>
			<FaqAccordion faqs={faqs} />
		</MemoryRouter>,
	);

describe("FaqAccordion markdown answers", () => {
	it("renders bold, inline code and lists instead of raw markers", () => {
		const { container } = renderFaqs([
			{
				q: "Formatting?",
				a: "Send **both** headers, the `secret-key` and:\n\n- one\n- two\n\nSecond paragraph.",
			},
		]);

		expect(screen.getByText("both").tagName).toBe("STRONG");
		expect(screen.getByText("secret-key").tagName).toBe("CODE");
		expect(container.querySelectorAll("li")).toHaveLength(2);
		expect(container.textContent).not.toContain("**");
		expect(container.textContent).not.toContain("- one");
	});

	it("never nests block content inside a paragraph", () => {
		const { container } = renderFaqs([
			{
				q: "Nesting?",
				a: "First paragraph.\n\n- a list item\n\nLast paragraph.",
			},
		]);

		for (const p of container.querySelectorAll("p")) {
			expect(p.parentElement?.closest("p")).toBeNull();
		}
		expect(container.querySelector("p ul")).toBeNull();
	});

	it("keeps internal links in the SPA and opens external ones in a new tab", () => {
		renderFaqs([
			{
				q: "Links?",
				a: "See [error codes](/docs/error-codes), [this section](#setup) and [UIDAI](https://uidai.gov.in).",
			},
		]);

		const internal = screen.getByRole("link", { name: "error codes" });
		expect(internal).toHaveAttribute("href", "/docs/error-codes");
		expect(internal).not.toHaveAttribute("target");

		expect(
			screen.getByRole("link", { name: "this section" }),
		).not.toHaveAttribute("target");

		const external = screen.getByRole("link", { name: "UIDAI" });
		expect(external).toHaveAttribute("target", "_blank");
		expect(external).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("treats protocol-relative URLs as external, not as routes", () => {
		renderFaqs([{ q: "Scheme?", a: "A [mirror](//cdn.example.com/x)." }]);

		const link = screen.getByRole("link", { name: "mirror" });
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("href", "//cdn.example.com/x");
	});

	it("renders the 'Also see' row through the same link rules", () => {
		renderFaqs([
			{
				q: "Also see?",
				a: "Body.",
				links: [
					{ label: "Docs", href: "/docs" },
					{ label: "Signup", href: "https://ekostore.app/eps" },
				],
			},
		]);

		expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute(
			"target",
		);
		expect(screen.getByRole("link", { name: "Signup" })).toHaveAttribute(
			"target",
			"_blank",
		);
	});

	it("accepts the question/answer field convention too", () => {
		renderFaqs([{ question: "Which shape?", answer: "**Both** work." }]);

		expect(screen.getByText("Which shape?")).toBeInTheDocument();
		expect(screen.getByText("Both").tagName).toBe("STRONG");
	});
});
