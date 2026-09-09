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

	it("warns on a personal PAN without blocking submission", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i);
		fireEvent.change(input, { target: { value: "ABCPE1234F" } });

		expect(screen.getByText(/looks like a personal PAN/i)).toBeInTheDocument();
		// The warning is advisory: a sole proprietor's personal PAN is correct
		// here, so Continue must stay live.
		expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
	});

	it("does not warn on a non-individual PAN", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCCE1234F" },
		});
		expect(
			screen.queryByText(/looks like a personal PAN/i),
		).not.toBeInTheDocument();
	});

	it("does not warn until the PAN is complete", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i);
		fireEvent.change(input, { target: { value: "ABCPE123" } });
		expect(
			screen.queryByText(/looks like a personal PAN/i),
		).not.toBeInTheDocument();

		fireEvent.change(input, { target: { value: "ABCPE1234F" } });
		expect(screen.getByText(/looks like a personal PAN/i)).toBeInTheDocument();
	});

	it("cleans a pasted PAN that carries spaces, keeping its last character", () => {
		// Regression: `maxLength={10}` truncated the raw paste before this handler
		// ran, so "ABCDE 1234 F" arrived as "ABCDE 1234" and lost the final letter.
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i);
		fireEvent.change(input, { target: { value: "abcde 1234 f" } });

		expect(input).toHaveValue("ABCDE1234F");
		expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
	});

	it("strips punctuation from a pasted PAN", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i);
		fireEvent.change(input, { target: { value: "ABCPE-1234-F" } });
		expect(input).toHaveValue("ABCPE1234F");
		// Category detection reads the cleaned value, so the warning still fires.
		expect(screen.getByText(/looks like a personal PAN/i)).toBeInTheDocument();
	});

	it("still caps input at ten characters", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i);
		fireEvent.change(input, { target: { value: "ABCDE1234FGHIJ" } });
		expect(input).toHaveValue("ABCDE1234F");
	});
});
