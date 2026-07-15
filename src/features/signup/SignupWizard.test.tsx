import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type SignupState } from "@/lib/auth/client";
import { SignupWizard } from "./SignupWizard";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	signupClient: {
		state: vi.fn(),
		createProfile: vi.fn(),
		submitPan: vi.fn(),
		submitPin: vi.fn(),
	},
}));

const mockRefresh = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: { status: "loading" }, refresh: mockRefresh, logout: vi.fn() }),
}));

const { signupClient } = await import("@/lib/auth/client");

/**
 * Types into a PIN field by its accessible name.
 *
 * `@testing-library/user-event` is not installed in this repo (no new
 * dependencies), so this drives the underlying `input-otp` field with
 * `fireEvent.change` instead, matching the pattern already used in
 * `PinStep.test.tsx`.
 */
function typePin(name: RegExp, value: string) {
	fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
}

const panPending: SignupState = {
	mobile: "9990000001",
	status: "in_progress",
	steps: [
		{ role: 13000, label: "PAN Details" },
		{ role: 12600, label: "Set Secret PIN" },
	],
	currentRole: 13000,
};
const pinPending: SignupState = { ...panPending, currentRole: 12600 };
const done: SignupState = { ...panPending, status: "done", currentRole: null };

beforeEach(() => vi.clearAllMocks());

describe("SignupWizard", () => {
	it("creates the partial account when the state is new", async () => {
		// `state()` resolves only after we've asserted the loading UI, so the
		// assertion can't lose a race against an already-resolved mock promise.
		let resolveState!: (value: SignupState) => void;
		vi.mocked(signupClient.state).mockReturnValue(
			new Promise((resolve) => {
				resolveState = resolve;
			}),
		);
		vi.mocked(signupClient.createProfile).mockResolvedValue(panPending);
		render(<SignupWizard />);
		expect(await screen.findByText(/setting up your account/i)).toBeInTheDocument();
		resolveState({ mobile: "9990000001", status: "new", steps: [], currentRole: null });
		await waitFor(() => expect(signupClient.createProfile).toHaveBeenCalled());
		expect(await screen.findByText("PAN Details")).toBeInTheDocument();
	});

	it("renders the current step and its progress", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		render(<SignupWizard />);
		expect(await screen.findByText("PAN Details")).toBeInTheDocument();
		expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
		expect(signupClient.createProfile).not.toHaveBeenCalled();
	});

	it("resumes at the pending step after a drop-off", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		expect(await screen.findByText("Set Secret PIN")).toBeInTheDocument();
		expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
	});

	// Regression guard: resolveSteps marks every step "complete" when
	// currentRole is null, even mid-flow (empty role_list from the backend).
	// The wizard must check state.status === "done" before falling back to
	// "!current", so this in-progress-but-no-current-step case renders the
	// unsupported-step message, not a false "you're all set" completion screen.
	it("does not show the completion screen when in progress with no current step", async () => {
		vi.mocked(signupClient.state).mockResolvedValue({
			...panPending,
			currentRole: null,
		});
		render(<SignupWizard />);
		expect(
			await screen.findByText(/isn't supported here yet/i),
		).toBeInTheDocument();
		expect(screen.queryByText(/you're all set/i)).not.toBeInTheDocument();
	});

	it("advances to the next step on success", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		vi.mocked(signupClient.submitPan).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		await screen.findByText("PAN Details");
		fireEvent.change(screen.getByLabelText(/pan/i), { target: { value: "ABCDE1234F" } });
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByText("Set Secret PIN")).toBeInTheDocument();
	});

	it("shows the server error and stays on the step", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		vi.mocked(signupClient.submitPan).mockRejectedValue(
			new ApiError("STEP_FAILED", "PAN already in use", 400),
		);
		render(<SignupWizard />);
		await screen.findByText("PAN Details");
		fireEvent.change(screen.getByLabelText(/pan/i), { target: { value: "ABCDE1234F" } });
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByRole("alert")).toHaveTextContent("PAN already in use");
		expect(screen.getByText("PAN Details")).toBeInTheDocument();
	});

	it("refreshes auth on completion so the session swaps to developer", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		vi.mocked(signupClient.submitPin).mockResolvedValue(done);
		render(<SignupWizard />);
		await screen.findByText("Set Secret PIN");
		typePin(/^secret pin/i, "1234");
		typePin(/confirm/i, "1234");
		fireEvent.click(screen.getByRole("button", { name: /finish/i }));
		expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
		await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
	});
});
