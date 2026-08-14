import { Header } from "@/components/Header";
import type { AuthState } from "@/lib/auth/AuthProvider";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const ANON: AuthState = { status: "anon" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: ANON, refresh: vi.fn(), logout: vi.fn() }),
}));

/** The trigger <button> for a desktop nav dropdown, e.g. "Products". */
const trigger = (label: string) => screen.getByRole("button", { name: label });
const isOpen = (label: string) =>
	trigger(label).getAttribute("aria-expanded") === "true";

/** The wrapper div carrying the onMouseEnter handler. */
const hover = (label: string) => {
	const wrapper = trigger(label).parentElement;
	if (!wrapper) throw new Error(`no wrapper for ${label}`);
	fireEvent.mouseEnter(wrapper);
};

const renderHeader = () =>
	render(
		<MemoryRouter initialEntries={["/"]}>
			<Header />
		</MemoryRouter>,
	);

describe("Header desktop dropdowns", () => {
	// Fake timers so a delayed hover-open (the behaviour this replaced) would
	// still be caught rather than passing on a synchronous assertion.
	it("does not open a panel on hover alone", () => {
		vi.useFakeTimers();
		try {
			renderHeader();
			hover("Products");
			hover("Company");
			act(() => vi.advanceTimersByTime(500));
			expect(isOpen("Products")).toBe(false);
			expect(isOpen("Company")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("toggles on click, and stays closed after a second click", () => {
		renderHeader();
		fireEvent.click(trigger("Products"));
		expect(isOpen("Products")).toBe(true);
		fireEvent.click(trigger("Products"));
		expect(isOpen("Products")).toBe(false);
	});

	it("swaps to a sibling on hover once a panel is open", () => {
		renderHeader();
		fireEvent.click(trigger("Products"));
		hover("Company");
		expect(isOpen("Company")).toBe(true);
		expect(isOpen("Products")).toBe(false);
	});

	// A hover-swapped panel is a normal open panel: one click closes it.
	it("closes a hover-swapped sibling on the first click", () => {
		renderHeader();
		fireEvent.click(trigger("Products"));
		hover("Company");
		fireEvent.click(trigger("Company"));
		expect(isOpen("Company")).toBe(false);
		expect(isOpen("Products")).toBe(false);
	});

	it("closes after the mouse leaves the header", async () => {
		vi.useFakeTimers();
		try {
			renderHeader();
			fireEvent.click(trigger("Products"));
			const header = document.querySelector("header");
			if (!header) throw new Error("no header");
			fireEvent.mouseLeave(header);
			expect(isOpen("Products")).toBe(true); // still open during the delay
			act(() => vi.advanceTimersByTime(200));
			expect(isOpen("Products")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});
