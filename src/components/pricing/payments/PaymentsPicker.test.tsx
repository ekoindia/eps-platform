// Guards the rate-explainer contract: the "?" only appears on rows whose
// commission actually moves with the amount, and — because it is a button
// living next to a <label> that wraps the rest of the row — clicking it must
// explain the rate WITHOUT silently ticking the product into the estimate.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsPicker } from "@/components/pricing/payments/PaymentsPicker";

let container: HTMLDivElement;
let root: Root;
const onToggle = vi.fn();

const renderPicker = () => {
	act(() => {
		root = createRoot(container);
		root.render(<PaymentsPicker selectedIds={[]} onToggle={onToggle} />);
	});
};

/** The "?" button on a product row, or null when the row has none. */
const explainerFor = (name: string) =>
	container.querySelector<HTMLButtonElement>(
		`button[aria-label="How the ${name} rate is calculated"]`,
	);

const click = (el: Element) =>
	act(() => {
		el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	onToggle.mockClear();
	renderPicker();
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe("PaymentsPicker rate explainer", () => {
	it("marks only the rows whose rate depends on the amount", () => {
		expect(explainerFor("Water Bill")).not.toBeNull(); // 1.2% of the bill
		expect(explainerFor("AePS Cash Withdrawal")).not.toBeNull();
		expect(explainerFor("Broadband")).toBeNull(); // flat ₹0.72
		expect(explainerFor("Electricity Bill")).toBeNull(); // flat ₹1.20
	});

	it("names the average amount the preview rate was computed at", () => {
		click(explainerFor("Water Bill")!);

		expect(document.body.textContent).toContain(
			"average bill of ₹800",
		);
	});

	it("does not select the product when the explainer is clicked", () => {
		click(explainerFor("Water Bill")!);

		expect(onToggle).not.toHaveBeenCalled();
	});

	it("still selects the product when the row itself is clicked", () => {
		const label = container.querySelector<HTMLLabelElement>(
			'label[for="' +
				container
					.querySelector('[role="checkbox"][aria-label="Water Bill"]')!
					.getAttribute("id") +
				'"]',
		);

		click(label!);

		expect(onToggle).toHaveBeenCalledTimes(1);
	});
});
