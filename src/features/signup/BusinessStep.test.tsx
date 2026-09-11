import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessStep } from "./BusinessStep";
import {
	SignupProfileProvider,
	type SignupProfile,
} from "./SignupProfileContext";

vi.mock("@/lib/auth/client", () => ({
	signupClient: { lookupPincode: vi.fn() },
}));

const { signupClient } = await import("@/lib/auth/client");
const lookupPincode = vi.mocked(signupClient.lookupPincode);

const noop = async () => {};

/** A profile whose name renders the verified box, with a Company-category PAN. */
const verifiedCompany: SignupProfile = {
	mobile: "9990000001",
	name: "Umbrella Foundation",
	pan: "AAATU1234E",
	panCategory: "C",
};

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
	const name = screen.queryByLabelText(/company\/firm's name/i);
	if (name) fireEvent.change(name, { target: { value: "Acme Retail" } });
	fireEvent.change(screen.getByLabelText(/authorised signatory/i), {
		target: { value: "Asha Rao" },
	});
	fireEvent.change(screen.getByLabelText(/work email/i), {
		target: { value: "asha@acme.in" },
	});
	fireEvent.change(screen.getByLabelText(/street address/i), {
		target: { value: "12 MG Road, Indiranagar" },
	});
	fireEvent.change(screen.getByLabelText(/^city$/i), {
		target: { value: "Bengaluru" },
	});
	fireEvent.change(screen.getByLabelText(/pin code/i), {
		target: { value: "560038" },
	});
};

beforeEach(() => {
	// Default: a PIN code nothing is known about, so the address fields behave
	// exactly as they would with the lookup absent.
	lookupPincode.mockResolvedValue({ city: null, state: null });
});

afterEach(() => {
	vi.clearAllMocks();
});

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
		const pincode = screen.getByLabelText(/pin code/i);
		// 6 characters (satisfies min/max) but non-numeric, so validateField
		// reaches the pattern check and returns the field's own message rather
		// than a length-based one.
		fireEvent.change(pincode, { target: { value: "5600ab" } });
		expect(screen.queryByText(/valid 6-digit PIN code/i)).toBeNull();
		fireEvent.blur(pincode);
		expect(screen.getByText(/valid 6-digit PIN code/i)).toBeInTheDocument();
	});

	it("renders the two group headings", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.getByText("Who signs the agreement")).toBeInTheDocument();
		expect(screen.getByText("Registered address")).toBeInTheDocument();
	});

	it("offers no second street-address line", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.queryByLabelText(/line 2/i)).toBeNull();
		expect(screen.queryByLabelText(/landmark/i)).toBeNull();
	});

	it("disables every field while busy", () => {
		renderStep({ onSubmit: noop, busy: true, error: null });
		expect(screen.getByLabelText(/company\/firm's name/i)).toBeDisabled();
		expect(screen.getByLabelText(/business type/i)).toBeDisabled();
		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
	});

	it("wires an invalid select's aria-describedby to its error message", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		const state = screen.getByLabelText(/^state$/i);
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

	it("submits every field keyed by name, trimmed, with no line 2", () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		renderStep({ onSubmit, busy: false, error: null });
		fillText();
		fireEvent.change(screen.getByLabelText(/company\/firm's name/i), {
			target: { value: "  Acme Retail  " },
		});
		fireEvent.change(screen.getByLabelText(/business type/i), {
			target: { value: "4" },
		});
		fireEvent.change(screen.getByLabelText(/^state$/i), {
			target: { value: "Karnataka" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Acme Retail",
			company_type: "4",
			authorized_signatory_name: "Asha Rao",
			email: "asha@acme.in",
			current_address_line1: "12 MG Road, Indiranagar",
			current_address_district: "Bengaluru",
			current_address_state: "Karnataka",
			current_address_pincode: "560038",
		});
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

	it("prefills email from the profile but leaves it editable", () => {
		renderStep(
			{ onSubmit: noop, busy: false, error: null },
			{ mobile: "9990000001", email: "asha@acme.in" },
		);
		const email = screen.getByLabelText(/work email/i);
		expect(email).toHaveValue("asha@acme.in");
		// Only `name` sets `lockWhenPrefilled`; the work email stays correctable.
		expect(email).not.toHaveAttribute("readonly");
	});

	it("says where the agreement is sent and which mobile carries the rest", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(
			screen.getByText(/reaches you on \+91 9990000001/i),
		).toBeInTheDocument();
	});
});

describe("BusinessStep verified-from-PAN box", () => {
	it("shows the registered name and the PAN it came from", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, verifiedCompany);
		expect(screen.getByText(/verified from PAN AAATU1234E/i)).toBeInTheDocument();
		expect(screen.getByText("Umbrella Foundation")).toBeInTheDocument();
		// The name is shown, not asked for.
		expect(screen.queryByLabelText(/company\/firm's name/i)).toBeNull();
	});

	it("omits the PAN when neither the server nor this session has one", () => {
		// The reload case: the profile still carries the name, but the PAN is gone.
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			...verifiedCompany,
			pan: undefined,
		});
		expect(screen.getByText("Umbrella Foundation")).toBeInTheDocument();
		expect(screen.queryByText(/from PAN/i)).toBeNull();
	});

	it("answers the business type from the PAN instead of asking", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, verifiedCompany);
		expect(screen.getByText("Private Limited")).toBeInTheDocument();
		expect(screen.queryByText(/how is the business registered/i)).toBeNull();
	});

	it("reveals the question when the type is edited, and drops it from the box", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, verifiedCompany);
		fireEvent.click(
			screen.getByRole("button", { name: /change business type/i }),
		);
		expect(
			screen.getByText(/how is the business registered/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/business type/i)).toHaveValue("1");
		// The box keeps the name but no longer states the type.
		expect(screen.getByText("Umbrella Foundation")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /change business type/i }),
		).toBeNull();
	});

	it("asks the question for a PAN category that cannot answer it", () => {
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			...verifiedCompany,
			panCategory: "P",
		});
		expect(
			screen.getByText(/your PAN doesn't say which of these you are/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/business type/i)).toHaveValue("");
		expect(businessTypeValues().slice(0, 2)).toEqual(["3", "7"]);
	});

	it("still asks the question when the name is unusable, so the field stays reachable", () => {
		// "&" fails the name pattern, so the verified box cannot render. Without
		// the guard this C-category PAN would hide the only Business Type control
		// and leave a required field with no input.
		renderStep({ onSubmit: noop, busy: false, error: null }, {
			...verifiedCompany,
			name: "Tata & Sons",
		});
		expect(
			screen.getByText(/how is the business registered/i),
		).toBeInTheDocument();
		const name = screen.getByLabelText(/company\/firm's name/i);
		expect(name).toHaveValue("Tata & Sons");
		expect(name).not.toHaveAttribute("readonly");
	});

	it("falls back to the name input when the profile has no name", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		expect(screen.queryByText(/verified/i)).toBeNull();
		expect(screen.getByLabelText(/company\/firm's name/i)).toHaveValue("");
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
});

describe("BusinessStep PIN code lookup", () => {
	it("fills City and State from a complete PIN code", async () => {
		lookupPincode.mockResolvedValue({
			city: "Bangalore",
			state: "Karnataka",
		});
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "560001" },
		});
		await waitFor(() =>
			expect(screen.getByLabelText(/^city$/i)).toHaveValue("Bangalore"),
		);
		expect(screen.getByLabelText(/^state$/i)).toHaveValue("Karnataka");
		expect(lookupPincode).toHaveBeenCalledTimes(1);
		expect(lookupPincode).toHaveBeenCalledWith("560001", expect.anything());
	});

	it("does not fire for an incomplete code", () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "56001" },
		});
		expect(lookupPincode).not.toHaveBeenCalled();
	});

	it("resolves a state name upstream spells differently", async () => {
		// 522 wants the full "National Capital Territory of Delhi (UT)"; the lookup
		// answers "Delhi". A literal match would leave the dropdown empty.
		lookupPincode.mockResolvedValue({ city: "New Delhi", state: "Delhi" });
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "110001" },
		});
		await waitFor(() =>
			expect(screen.getByLabelText(/^state$/i)).toHaveValue(
				"National Capital Territory of Delhi (UT)",
			),
		);
	});

	it("leaves the dropdown alone for a state it cannot match", async () => {
		lookupPincode.mockResolvedValue({ city: "Leh", state: "Ladakh" });
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "194101" },
		});
		await waitFor(() =>
			expect(screen.getByLabelText(/^city$/i)).toHaveValue("Leh"),
		);
		expect(screen.getByLabelText(/^state$/i)).toHaveValue("");
	});

	it("assigns nothing when the response carries no city", async () => {
		lookupPincode.mockResolvedValue({ city: null, state: null });
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "999999" },
		});
		await waitFor(() => expect(lookupPincode).toHaveBeenCalled());
		expect(screen.getByLabelText(/^city$/i)).toHaveValue("");
	});

	it("stays silent when the lookup fails", async () => {
		lookupPincode.mockRejectedValue(new Error("boom"));
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "560001" },
		});
		await waitFor(() => expect(lookupPincode).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByLabelText(/^city$/i)).not.toHaveAttribute("readonly");
	});

	it("clears the previous code's values when the next one finds nothing", async () => {
		lookupPincode.mockResolvedValueOnce({
			city: "Bangalore",
			state: "Karnataka",
		});
		renderStep({ onSubmit: noop, busy: false, error: null });
		const pincode = screen.getByLabelText(/pin code/i);
		fireEvent.change(pincode, { target: { value: "560001" } });
		await waitFor(() =>
			expect(screen.getByLabelText(/^city$/i)).toHaveValue("Bangalore"),
		);

		// Second code is unknown upstream. Leaving Bangalore/Karnataka in place
		// would be a complete, valid, wrong address.
		lookupPincode.mockResolvedValueOnce({ city: null, state: null });
		fireEvent.change(pincode, { target: { value: "999999" } });
		await waitFor(() =>
			expect(screen.getByLabelText(/^city$/i)).toHaveValue(""),
		);
		expect(screen.getByLabelText(/^state$/i)).toHaveValue("");
	});

	it("never clears a city the user typed themselves", async () => {
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/^city$/i), {
			target: { value: "Mysuru" },
		});
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "560001" },
		});
		await waitFor(() => expect(lookupPincode).toHaveBeenCalled());
		expect(screen.getByLabelText(/^city$/i)).toHaveValue("Mysuru");
	});

	it("does not overwrite an edit made while the lookup is in flight", async () => {
		let settle: (v: { city: string; state: string }) => void = () => {};
		lookupPincode.mockReturnValue(
			new Promise((resolve) => {
				settle = resolve;
			}),
		);
		renderStep({ onSubmit: noop, busy: false, error: null });
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "560001" },
		});
		// The user gets there first. Aborting on a PIN-code change would not
		// cover this — the code has not changed.
		fireEvent.change(screen.getByLabelText(/^city$/i), {
			target: { value: "Mysuru" },
		});
		settle({ city: "Bangalore", state: "Karnataka" });
		await waitFor(() =>
			expect(screen.getByLabelText(/^state$/i)).toHaveValue("Karnataka"),
		);
		expect(screen.getByLabelText(/^city$/i)).toHaveValue("Mysuru");
	});

	it("aborts an in-flight lookup on unmount", async () => {
		lookupPincode.mockReturnValue(new Promise(() => {}));
		const { unmount } = renderStep({
			onSubmit: noop,
			busy: false,
			error: null,
		});
		fireEvent.change(screen.getByLabelText(/pin code/i), {
			target: { value: "560001" },
		});
		const signal = lookupPincode.mock.calls[0][1] as AbortSignal;
		expect(signal.aborted).toBe(false);
		unmount();
		expect(signal.aborted).toBe(true);
	});
});
