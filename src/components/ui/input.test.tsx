import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input, groupDigits } from "@/components/ui/input";

/** Controlled wrapper mirroring the real LoginForm call site; `raw` shows the value the parent stores. */
function Harness({ initial = "", plain = false }) {
	const [value, setValue] = useState(initial);
	return (
		<>
			<Input
				aria-label="mobile"
				prefix="+91"
				digitGroups={plain ? undefined : [3, 3, 4]}
				value={value}
				onChange={(e) => setValue(e.target.value)}
			/>
			<output data-testid="raw">{value}</output>
		</>
	);
}

const field = () => screen.getByLabelText("mobile") as HTMLInputElement;
const raw = () => screen.getByTestId("raw").textContent;

/**
 * Simulates an edit that leaves the caret mid-string. `fireEvent.change` can't:
 * assigning `.value` parks the caret at the end. Writing through the prototype
 * setter also sidesteps React's value tracker, so the input event still fires.
 */
function editAt(el: HTMLInputElement, value: string, caret: number) {
	const setValue = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)!.set!;
	setValue.call(el, value);
	el.setSelectionRange(caret, caret);
	fireEvent.input(el);
}

describe("groupDigits", () => {
	it("groups by the given sizes and tolerates partial input", () => {
		expect(groupDigits("6710000002", [3, 3, 4])).toBe("671 000 0002");
		expect(groupDigits("67100", [3, 3, 4])).toBe("671 00");
		expect(groupDigits("", [3, 3, 4])).toBe("");
		// Digits past the last group are kept as a trailing group, never dropped.
		expect(groupDigits("12345", [2, 2])).toBe("12 34 5");
	});
});

describe("Input with digitGroups", () => {
	it("displays grouped digits while handing raw digits to onChange", () => {
		render(<Harness />);
		fireEvent.change(field(), { target: { value: "6710000002" } });
		expect(field().value).toBe("671 000 0002");
		expect(raw()).toBe("6710000002");
	});

	it("sets tel/numeric input affordances", () => {
		render(<Harness />);
		expect(field()).toHaveAttribute("type", "tel");
		expect(field()).toHaveAttribute("inputmode", "numeric");
	});

	it("ignores non-digits", () => {
		render(<Harness />);
		fireEvent.change(field(), { target: { value: "671a-b" } });
		expect(raw()).toBe("671");
		expect(field().value).toBe("671");
	});

	it("caps entry at the sum of the groups", () => {
		render(<Harness />);
		fireEvent.change(field(), { target: { value: "67100000021234" } });
		expect(raw()).toBe("6710000002");
		expect(field().value).toBe("671 000 0002");
	});

	it("keeps the caret in place when deleting mid-number", () => {
		render(<Harness initial="6710000002" />);
		const el = field();
		expect(el.value).toBe("671 000 0002");
		// Backspace the "1" with the caret sitting after "671".
		editAt(el, "67 000 0002", 2);
		expect(raw()).toBe("670000002");
		expect(el.value).toBe("670 000 002");
		// Caret stays after the 2 digits that preceded it, rather than jumping to the end.
		expect(el.selectionStart).toBe(2);
	});

	it("pastes the last 10 digits, dropping a 91/0 lead-in and separators", () => {
		render(<Harness />);
		fireEvent.paste(field(), {
			clipboardData: { getData: () => "+91 0 999-000 0001" },
		});
		expect(raw()).toBe("9990000001");
		expect(field().value).toBe("999 000 0001");
	});

	it("copies the selection without the grouping spaces", () => {
		render(<Harness initial="6710000002" />);
		const setData = vi.fn();
		field().setSelectionRange(0, field().value.length);
		fireEvent.copy(field(), { clipboardData: { setData } });
		expect(setData).toHaveBeenCalledWith("text/plain", "6710000002");
	});

	it("copies only the selected part of the number", () => {
		render(<Harness initial="6710000002" />);
		const setData = vi.fn();
		field().setSelectionRange(0, 7); // "671 000"
		fireEvent.copy(field(), { clipboardData: { setData } });
		expect(setData).toHaveBeenCalledWith("text/plain", "671000");
	});

	it("cuts: strips spaces to the clipboard AND removes the selection", () => {
		render(<Harness initial="6710000002" />);
		const setData = vi.fn();
		field().setSelectionRange(0, 4); // "671 "
		fireEvent.cut(field(), { clipboardData: { setData } });
		expect(setData).toHaveBeenCalledWith("text/plain", "671");
		expect(raw()).toBe("0000002");
		expect(field().value).toBe("000 000 2");
	});

	it("renders the prefix addon without swallowing the label association", () => {
		render(<Harness />);
		expect(screen.getByText("+91")).toBeInTheDocument();
		expect(field()).toBeInTheDocument();
	});
});

describe("Input without digitGroups", () => {
	it("passes the value straight through", () => {
		render(<Harness plain />);
		fireEvent.change(field(), { target: { value: "hello 123" } });
		expect(raw()).toBe("hello 123");
		expect(field().value).toBe("hello 123");
	});

	it("leaves a caller's type alone", () => {
		render(<Input aria-label="pw" type="password" />);
		expect(screen.getByLabelText("pw")).toHaveAttribute("type", "password");
	});
});
