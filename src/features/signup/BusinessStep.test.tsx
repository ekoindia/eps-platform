import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessStep } from "./BusinessStep";
import {
	SignupProfileProvider,
	type SignupProfile,
} from "./SignupProfileContext";

const noop = async () => {};

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
		expect(screen.getByLabelText(/company type/i)).toBeDisabled();
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
		fireEvent.change(screen.getByLabelText(/company type/i), {
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
});
