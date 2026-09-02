import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SupportContact from "@/components/console/SupportContact";

// The component reads `VITE_SUPPORT_*` through module constants, which are read
// once at import; the props are the seam that lets one file cover every
// combination without a per-value mock file.
describe("SupportContact", () => {
	it("renders nothing when no channel is configured", () => {
		const { container } = render(
			<SupportContact email="" phone="" whatsapp="" />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing when the values are only whitespace or punctuation", () => {
		const { container } = render(
			<SupportContact email="  " phone=" " whatsapp="+ " />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows only the channels that are configured", () => {
		render(
			<SupportContact email="eps.support@eko.co.in" phone="" whatsapp="" />,
		);
		expect(
			screen.getByRole("link", { name: "Email support at eps.support@eko.co.in" }),
		).toHaveAttribute("href", "mailto:eps.support@eko.co.in");
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it("formats a bare 10-digit number and country-codes both links", () => {
		render(<SupportContact email="" phone="9513181707" whatsapp="9513181707" />);
		// Env carries the national number; the strip shows it grouped, and both
		// URLs get the country code.
		expect(
			screen.getByRole("link", { name: "Call support at +91 951 318 1707" }),
		).toHaveAttribute("href", "tel:+919513181707");
		// Visible text, not just the accessible name — once per channel.
		expect(screen.getAllByText("+91 951 318 1707")).toHaveLength(2);
		const wa = screen.getByRole("link", {
			name: "WhatsApp support at +91 951 318 1707",
		});
		expect(wa).toHaveAttribute("href", "https://wa.me/919513181707");
		// Third-party origin, opened away from the console tab.
		expect(wa).toHaveAttribute("target", "_blank");
		expect(wa).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("leaves an already country-coded number alone", () => {
		render(<SupportContact email="" phone="+91 95131 81707" whatsapp="" />);
		expect(
			screen.getByRole("link", { name: /Call support/ }),
		).toHaveAttribute("href", "tel:+919513181707");
	});
});
