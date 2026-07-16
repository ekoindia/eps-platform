import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PinStep } from "./PinStep";

const noop = async () => {};

/**
 * Types into a PIN field by its accessible name.
 *
 * `@testing-library/user-event` is not installed in this repo (no new
 * dependencies), so this drives the underlying `input-otp` field with
 * `fireEvent.change` instead, matching the pattern already used in
 * `PanStep.test.tsx`.
 */
async function typePin(name: RegExp, value: string) {
	const field = screen.getByRole("textbox", { name });
	fireEvent.change(field, { target: { value } });
}

describe("PinStep", () => {
	it("disables submit until both PINs are complete and equal", async () => {
		render(<PinStep onSubmit={noop} busy={false} error={null} />);
		const button = screen.getByRole("button", { name: /finish|continue/i });
		expect(button).toBeDisabled();
		await typePin(/^secret pin/i, "1234");
		expect(button).toBeDisabled();
		await typePin(/confirm/i, "1234");
		expect(button).toBeEnabled();
	});

	it("keeps submit disabled and warns when the PINs differ", async () => {
		render(<PinStep onSubmit={noop} busy={false} error={null} />);
		await typePin(/^secret pin/i, "1234");
		await typePin(/confirm/i, "5678");
		expect(
			screen.getByRole("button", { name: /finish|continue/i }),
		).toBeDisabled();
		expect(screen.getByText(/do not match/i)).toBeInTheDocument();
	});

	it("submits both PINs", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<PinStep onSubmit={onSubmit} busy={false} error={null} />);
		await typePin(/^secret pin/i, "1234");
		await typePin(/confirm/i, "1234");
		fireEvent.click(screen.getByRole("button", { name: /finish|continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({ pin1: "1234", pin2: "1234" });
	});

	it("submits a PIN of 0000 — a falsy-string check would wrongly reject it", async () => {
		// Guards against refactoring `pin1.length === PIN_LENGTH` to `!pin1`.
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<PinStep onSubmit={onSubmit} busy={false} error={null} />);
		await typePin(/^secret pin/i, "0000");
		await typePin(/confirm/i, "0000");
		const button = screen.getByRole("button", { name: /finish|continue/i });
		expect(button).toBeEnabled();
		fireEvent.click(button);
		expect(onSubmit).toHaveBeenCalledWith({ pin1: "0000", pin2: "0000" });
	});

	it("shows a server error", () => {
		render(<PinStep onSubmit={noop} busy={false} error="Could not set PIN" />);
		expect(screen.getByRole("alert")).toHaveTextContent("Could not set PIN");
	});
});
