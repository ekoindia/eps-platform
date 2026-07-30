import {
	Dialog,
	DialogContent,
	DialogTitle,
	ignoreNestedDialogInteraction,
} from "@/components/ui/dialog";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Fakes Radix's outside-interaction event around a target.
 * @param target - What the pointer went down on.
 */
function outsideEvent(target: Element) {
	const preventDefault = vi.fn();
	return {
		event: { detail: { originalEvent: { target } as unknown as Event } },
		preventDefault,
	};
}

/** Runs the guard over a target and reports whether it suppressed the dismiss. */
function suppressed(target: Element): boolean {
	const { event, preventDefault } = outsideEvent(target);
	ignoreNestedDialogInteraction({ ...event, preventDefault });
	return preventDefault.mock.calls.length > 0;
}

/**
 * The console stacks dialogs: the KYC upload dialog opens the image viewer, and
 * the camera opens the editor. Radix defers its "am I the top layer?" test to
 * the click after the pointerdown, by which point the dialog above has already
 * unmounted and the one below wrongly reads as topmost — so closing the viewer
 * used to close the upload dialog and lose every attached page.
 *
 * That ordering does not reproduce under jsdom (an unguarded pair behaves
 * correctly here), so these cover the guard's decision directly and the
 * behaviour it must not break. The stacking itself is checked by hand on the
 * dev-only bench at `/console/test`.
 */
describe("ignoreNestedDialogInteraction", () => {
	it("suppresses an interaction inside a dialog stacked above", () => {
		const above = document.createElement("div");
		above.setAttribute("role", "dialog");
		const close = document.createElement("button");
		above.append(close);

		expect(suppressed(close)).toBe(true);
	});

	// The likeliest way to close the dialog above, and the one Radix leaves
	// unmarked — an overlay carries no role.
	it("suppresses an interaction on the backdrop of a dialog above", () => {
		const backdrop = document.createElement("div");
		backdrop.setAttribute("data-dialog-layer", "");

		expect(suppressed(backdrop)).toBe(true);
	});

	it("leaves an ordinary outside interaction alone", () => {
		const elsewhere = document.createElement("div");
		document.body.append(elsewhere);

		expect(suppressed(elsewhere)).toBe(false);
	});
});

describe("DialogContent", () => {
	/** Radix registers its outside-pointer listener in a timeout. */
	const settle = () =>
		act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

	function Single() {
		const [open, setOpen] = useState(true);
		return (
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogTitle>Upload document</DialogTitle>
				</DialogContent>
			</Dialog>
		);
	}

	it("still closes on a press outside, with nothing stacked above it", async () => {
		render(<Single />);
		await settle();

		fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
		fireEvent.pointerUp(document.body, { button: 0, pointerType: "mouse" });
		fireEvent.click(document.body, { button: 0 });
		await settle();

		expect(screen.queryByText("Upload document")).not.toBeInTheDocument();
	});
});
