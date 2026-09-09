import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessStep } from "./BusinessStep";
import {
	SignupProfileProvider,
	type SignupProfile,
} from "./SignupProfileContext";

const noop = async () => {};

/**
 * Business Type's option values, in render order, minus the placeholder. Scoped
 * to that select — the State dropdown contributes 36 more options to the page.
 */
const businessTypeValues = () =>
	within(screen.getByLabelText(/business type/i) as HTMLSelectElement)
		.getAllByRole("option")
		.map((o) => (o as HTMLOptionElement).value)
		.filter((v) => v !== "");

/** Renders BusinessStep inside a profile provider (empty profile by default). */
const renderStep = (
	props: Parameters<typeof BusinessStep>[0],
	profile: SignupProfile = { mobile: "9990000001" },
) =>
	render(
		<SignupProfileProvider profile={profile}>
			<BusinessStep {...props} />
		</SignupProfileProvider>,
	);

/** Fills every text field with valid input. Selects are set separately. */
const fillText = () => {
	fireEvent.change(screen.getByLabelText(/company\/firm's name/i), {
		target: { value: "Acme Retail" },
	});
	fireEvent.change(screen.getByLabelText(/authorised signatory/i), {
		target: { value: "Asha Rao" },
	});
	fireEvent.change(screen.getByLabelText(/email address/i), {
		target: { value: "asha@acme.in" },
	});
	fireEvent.change(screen.getByLabelText(/address \(line 1\)/i), {
		target: { value: "12 MG Road, Indiranagar" },
	});
	fireEvent.change(screen.getByLabelText(/city/i), {
		target: { value: "Bengaluru" },
	});
	fireEvent.change(screen.getByLabelText(/pincode/i), {
		target: { value: "560038" },
	});
};

describe("BusinessStep", () => {
	it("disables submit until every required field is valid", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		const button = screen.getByRole("button", { name: /continue/i });
		expect(button).toBeDisabled();
		fillText();
		// Both selects are still empty, so it stays disabled.
		expect(button).toBeDisabled();
	});

	it("shows a field error on blur, not while typing", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		const pincode = screen.getByLabelText(/pincode/i);
		// 6 characters (satisfies min/max) but non-numeric, so validateField
		// reaches the pattern check and returns the field's own message rather
		// than a length-based one.
		fireEvent.change(pincode, { target: { value: "5600ab" } });
		expect(screen.queryByText(/valid 6-digit pincode/i)).toBeNull();
		fireEvent.blur(pincode);
		expect(screen.getByText(/valid 6-digit pincode/i)).toBeInTheDocument();
	});

	it("accepts a blank optional address line 2", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		const line2 = screen.getByLabelText(/address \(line 2/i);
		fireEvent.blur(line2);
		expect(screen.queryByText(/enter a valid address/i)).toBeNull();
	});

	it("renders the three group headings", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.getByText("Business")).toBeInTheDocument();
		expect(screen.getByText("Contact")).toBeInTheDocument();
		expect(screen.getByText("Address")).toBeInTheDocument();
	});

	it("disables every field while busy", () => {
		renderStep({ onSubmit: noop, busy: true, error: null });
		expect(screen.getByLabelText(/company\/firm's name/i)).toBeDisabled();
		expect(screen.getByLabelText(/business type/i)).toBeDisabled();
		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
	});

	it("wires an invalid select's aria-describedby to its error message", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		const state = screen.getByLabelText(/state/i);
		fireEvent.blur(state);
		const message = screen.getByText(/state is required/i);
		expect(message).toHaveAttribute("id", "current_address_state-error");
		expect(state).toHaveAttribute(
			"aria-describedby",
			"current_address_state-error",
		);
		expect(state).toHaveAttribute("aria-invalid", "true");
	});

	it("shows a server error", () => {
		renderStep({ onSubmit: noop, busy: false, error: "Invalid pincode" });
		expect(screen.getByRole("alert")).toHaveTextContent("Invalid pincode");
	});

	it("submits every field keyed by name, trimmed", () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		renderStep({ onSubmit, busy: false, error: null });
		fillText();
		fireEvent.change(screen.getByLabelText(/company\/firm's name/i), {
			target: { value: "  Acme Retail  " },
		});
		fireEvent.change(screen.getByLabelText(/business type/i), {
			target: { value: "4" },
		});
		fireEvent.change(screen.getByLabelText(/state/i), {
			target: { value: "Karnataka" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Acme Retail",
			company_type: "4",
			authorized_signatory_name: "Asha Rao",
			email: "asha@acme.in",
			current_address_line1: "12 MG Road, Indiranagar",
			current_address_line2: "",
			current_address_district: "Bengaluru",
			current_address_state: "Karnataka",
			current_address_pincode: "560038",
		});
	});

	it("prefills name and email from the profile", () => {
		renderStep(
			{ onSubmit: noop, busy: false, error: null },
			{ mobile: "9990000001", name: "Asha Rao", email: "asha@acme.in" },
		);
		expect(screen.getByLabelText(/company\/firm's name/i)).toHaveValue(
			"Asha Rao",
		);
		expect(screen.getByLabelText(/email address/i)).toHaveValue("asha@acme.in");
	});

	it("locks a prefilled name read-only but leaves email editable", () => {
		renderStep(
			{ onSubmit: noop, busy: false, error: null },
			{ mobile: "9990000001", name: "Asha Rao", email: "asha@acme.in" },
		);
		expect(screen.getByLabelText(/company\/firm's name/i)).toHaveAttribute(
			"readonly",
		);
		expect(screen.getByLabelText(/email address/i)).not.toHaveAttribute(
			"readonly",
		);
	});

	it("prefills but does not lock an invalid profile name", () => {
		renderStep(
			{ onSubmit: noop, busy: false, error: null },
			{ mobile: "9990000001", name: "Tata & Sons", email: "asha@acme.in" },
		);
		const name = screen.getByLabelText(/company\/firm's name/i);
		expect(name).toHaveValue("Tata & Sons");
		expect(name).not.toHaveAttribute("readonly");
	});

	it("leaves name editable when the profile has no name", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.getByLabelText(/company\/firm's name/i)).toHaveValue("");
		expect(screen.getByLabelText(/company\/firm's name/i)).not.toHaveAttribute(
			"readonly",
		);
	});

	it("preselects Business Type from the PAN category and says so", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			mobile: "9990000001",
			panCategory: "C",
		});
		const select = screen.getByLabelText(/business type/i);
		expect(select).toHaveValue("1"); // Private Limited
		expect(
			screen.getByText(/auto-filled from your PAN/i),
		).toBeInTheDocument();
	});

	it("drops the auto-filled hint once the user picks something else", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			mobile: "9990000001",
			panCategory: "C",
		});
		fireEvent.change(screen.getByLabelText(/business type/i), {
			target: { value: "2" },
		});
		expect(
			screen.queryByText(/auto-filled from your PAN/i),
		).not.toBeInTheDocument();
	});

	it("floats the PAN category's candidates to the top without dropping any", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			mobile: "9990000001",
			panCategory: "F",
		});
		const options = businessTypeValues();
		expect(options.slice(0, 2)).toEqual(["4", "2"]); // LLP, Partnership
		expect(options).toHaveLength(6); // every option still selectable
	});

	it("leaves Business Type blank for an individual PAN, but leads with its candidates", () => {
		// P is ambiguous between Sole Proprietorship and Individual, so it orders
		// but never guesses.
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			mobile: "9990000001",
			panCategory: "P",
		});
		expect(screen.getByLabelText(/business type/i)).toHaveValue("");
		expect(
			screen.queryByText(/auto-filled from your PAN/i),
		).not.toBeInTheDocument();
		expect(businessTypeValues().slice(0, 2)).toEqual(["3", "7"]);
	});

	it("leaves Business Type blank and unordered with no PAN category", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.getByLabelText(/business type/i)).toHaveValue("");
		expect(
			screen.queryByText(/auto-filled from your PAN/i),
		).not.toBeInTheDocument();
	});

	it("submits Individual (upstream code 7), which validation must not reject", () => {
		const onSubmit = vi.fn(async () => {});
		renderStep({ onSubmit, busy: false, error: null });
		fillText();
		fireEvent.change(screen.getByLabelText(/business type/i), {
			target: { value: "7" },
		});
		fireEvent.change(screen.getByLabelText(/^state$/i), {
			target: { value: "Karnataka" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ company_type: "7" }),
		);
	});
});
