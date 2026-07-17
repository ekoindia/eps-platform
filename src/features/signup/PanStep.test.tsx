import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanStep } from "./PanStep";

const noop = async () => {};

describe("PanStep", () => {
	it("disables submit until the PAN is valid", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const button = screen.getByRole("button", { name: /continue/i });
		expect(button).toBeDisabled();
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE1234F" },
		});
		expect(button).toBeEnabled();
	});

	it("keeps submit disabled for a malformed PAN", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE12345" },
		});
		expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
	});

	it("uppercases typed input", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "abcde1234f" } });
		expect(input.value).toBe("ABCDE1234F");
	});

	it("submits the PAN", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<PanStep onSubmit={onSubmit} busy={false} error={null} />);
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE1234F" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({ pan: "ABCDE1234F" });
	});

	it("disables the field and button while busy", () => {
		render(<PanStep onSubmit={noop} busy={true} error={null} />);
		expect(screen.getByLabelText(/pan/i)).toBeDisabled();
		expect(screen.getByRole("button")).toBeDisabled();
	});

	it("shows a server error", () => {
		render(<PanStep onSubmit={noop} busy={false} error="PAN already in use" />);
		expect(screen.getByRole("alert")).toHaveTextContent("PAN already in use");
	});
});
