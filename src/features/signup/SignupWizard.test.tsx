import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type SignupState } from "@/lib/auth/client";
import { RETRY_DELAYS_MS } from "@/lib/retry";
import { SignupWizard } from "./SignupWizard";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	signupClient: {
		state: vi.fn(),
		createProfile: vi.fn(),
		submitPan: vi.fn(),
		submitPin: vi.fn(),
		submitBusiness: vi.fn(),
	},
}));

const mockRefresh = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({
		state: { status: "loading" },
		refresh: mockRefresh,
		logout: vi.fn(),
	}),
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
	fireEvent.change(screen.getByRole("textbox", { name }), {
		target: { value },
	});
}

/**
 * Finds the card heading for a step.
 *
 * A step's label now appears twice — once in the rail, once as the card
 * heading — so plain text queries are ambiguous. The heading is the "you are
 * here" signal, which is what these tests mean by "the current step".
 */
const findStepHeading = (name: string) =>
	screen.findByRole("heading", { name, level: 3 });

/**
 * Finds the PAN step's heading.
 *
 * The PAN step opts into `ownsHeading`, so it writes its own copy in its own
 * words at level 2 instead of taking the wizard's CardTitle. The rail still
 * says "PAN Details" — the two names coexist by design, which is why this is a
 * separate helper rather than a wider `findStepHeading`.
 */
const findPanHeading = () =>
	screen.findByRole("heading", { name: "First, your PAN", level: 2 });

/** The Business step's own heading — it opts into `ownsHeading` too. */
const findBusinessHeading = () =>
	screen.findByRole("heading", {
		name: "Now, your business details",
		level: 2,
	});

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

/** A PAN -> Business Details flow, for the cross-step prefill tests below. */
const businessFlow: SignupState = {
	mobile: "9990000001",
	status: "in_progress",
	steps: [
		{ role: 13000, label: "PAN Details" },
		// Upstream still calls this "Company Details"; the registry label wins.
		{ role: 13100, label: "Company Details" },
	],
	currentRole: 13000,
};
const businessPending: SignupState = { ...businessFlow, currentRole: 13100 };
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
		expect(
			await screen.findByText(/setting up your account/i),
		).toBeInTheDocument();
		resolveState({
			mobile: "9990000001",
			status: "new",
			steps: [],
			currentRole: null,
		});
		await waitFor(() => expect(signupClient.createProfile).toHaveBeenCalled());
		expect(await findPanHeading()).toBeInTheDocument();
	});

	// Regression guard: the mount effect used to pair a `started` ref with a
	// `cancelled` closure flag. Under a StrictMode double-mount, run 1's
	// cleanup set `cancelled = true` before run 2 early-returned (no new fetch,
	// no new cleanup), so run 1's in-flight promise resolved into a `cancelled`
	// check and skipped `setState` forever — the wizard hung on "Setting up
	// your account…" permanently. `cancelled` is gone now (setState on an
	// unmounted component is a no-op in React 18+), so this must resolve past
	// loading, and `started` alone must still stop a second `createProfile()`.
	it("resolves out of loading under StrictMode, calling createProfile at most once", async () => {
		vi.mocked(signupClient.state).mockResolvedValue({
			mobile: "9990000001",
			status: "new",
			steps: [],
			currentRole: null,
		});
		vi.mocked(signupClient.createProfile).mockResolvedValue(panPending);
		render(
			<StrictMode>
				<SignupWizard />
			</StrictMode>,
		);
		expect(await findPanHeading()).toBeInTheDocument();
		expect(signupClient.createProfile).toHaveBeenCalledTimes(1);
	});

	it("renders the current step and its progress", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		render(<SignupWizard />);
		expect(await findPanHeading()).toBeInTheDocument();
		expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
		expect(signupClient.createProfile).not.toHaveBeenCalled();
	});

	// The rail must name every step, not just the current one — that is the
	// whole point of it over the old "Step 1 of 2" counter.
	it("lists every step in the rail, marking the current one and the rest pending", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		render(<SignupWizard />);
		const rail = within(
			await screen.findByRole("navigation", { name: /signup progress/i }),
		);
		expect(rail.getByText(/PAN Details, current step/)).toBeInTheDocument();
		expect(rail.getByText(/Set Secret PIN, not started/)).toBeInTheDocument();
	});

	it("marks a finished step complete in the rail", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		const rail = within(
			await screen.findByRole("navigation", { name: /signup progress/i }),
		);
		expect(rail.getByText(/PAN Details, completed/)).toBeInTheDocument();
		expect(rail.getByText(/Set Secret PIN, current step/)).toBeInTheDocument();
	});

	it("resumes at the pending step after a drop-off", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		expect(await findStepHeading("Set Secret PIN")).toBeInTheDocument();
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
		await findPanHeading();
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE1234F" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByText("Set Secret PIN")).toBeInTheDocument();
	});

	// A bare STEP_FAILED reads as a transient upstream blip, so `withRetries`
	// spends all three attempts before the user is told anything. Fake timers keep
	// that 4s of backoff out of the suite's wall clock.
	it("retries, then shows the server error and stays on the step", async () => {
		vi.useFakeTimers();
		try {
			vi.mocked(signupClient.state).mockResolvedValue(panPending);
			vi.mocked(signupClient.submitPan).mockRejectedValue(
				new ApiError("STEP_FAILED", "PAN already in use", 400),
			);
			render(<SignupWizard />);
			await vi.advanceTimersByTimeAsync(0);
			fireEvent.change(screen.getByLabelText(/pan/i), {
				target: { value: "ABCDE1234F" },
			});
			fireEvent.click(screen.getByRole("button", { name: /continue/i }));

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
			expect(signupClient.submitPan).toHaveBeenCalledTimes(2);
			expect(screen.queryByRole("alert")).toBeNull();

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
			expect(signupClient.submitPan).toHaveBeenCalledTimes(3);

			// One more flush: the third rejection still has to travel back out
			// through `withRetries` before `runStep` can render it.
			await vi.advanceTimersByTimeAsync(0);
			expect(screen.getByRole("alert")).toHaveTextContent("PAN already in use");
			expect(
				screen.getByRole("heading", { name: "First, your PAN", level: 2 }),
			).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it("refreshes auth on completion so the session swaps to developer", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		vi.mocked(signupClient.submitPin).mockResolvedValue(done);
		render(<SignupWizard />);
		await findStepHeading("Set Secret PIN");
		typePin(/^secret pin/i, "1234");
		typePin(/confirm/i, "1234");
		fireEvent.click(screen.getByRole("button", { name: /finish/i }));
		expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
		await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
	});

	it("carries the PAN category into the Business step's prefill", async () => {
		// BusinessStep seeds company_type in a one-time lazy initialiser, so the
		// category has to be in the provider by the time that step first mounts.
		// Component tests cannot see this — only the wizard wires the two steps.
		vi.mocked(signupClient.state).mockResolvedValue(businessFlow);
		vi.mocked(signupClient.submitPan).mockResolvedValue(businessPending);
		render(<SignupWizard />);

		fireEvent.change(await screen.findByLabelText(/pan/i), {
			target: { value: "ABCCE1234F" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));

		await findBusinessHeading();
		expect(screen.getByLabelText(/business type/i)).toHaveValue("1");
	});

	it("prefills from the retried PAN after a failed attempt, not the first one", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(businessFlow);
		vi.mocked(signupClient.submitPan)
			.mockRejectedValueOnce(// INVALID_INPUT is in NEVER_RETRY, so this surfaces immediately
			// rather than burning the backoff.
			new ApiError("INVALID_INPUT", "Bad PAN.", 400))
			.mockResolvedValueOnce(businessPending);
		render(<SignupWizard />);

		const input = await screen.findByLabelText(/pan/i);
		// First attempt: a firm PAN that fails upstream.
		fireEvent.change(input, { target: { value: "ABCFE1234F" } });
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Bad PAN.");

		// Retry with a company PAN — the prefill must follow the retry.
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCCE1234F" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));

		await findBusinessHeading();
		expect(screen.getByLabelText(/business type/i)).toHaveValue("1");
	});

	it("rails the middle step from the registry, ignoring the API's label", async () => {
		// The card owns its heading now, so the registry label survives only in
		// the rail — that is where upstream's "Company Details" must not appear.
		vi.mocked(signupClient.state).mockResolvedValue(businessPending);
		render(<SignupWizard />);

		await findBusinessHeading();
		const rail = screen.getByRole("navigation", { name: /signup progress/i });
		expect(
			within(rail).getByText(/Business Details, current step/),
		).toBeInTheDocument();
		expect(screen.queryByText("Company Details")).not.toBeInTheDocument();
	});

	it("shows the server's PAN in the Business step", async () => {
		// Survives a reload, unlike the in-session capture below.
		vi.mocked(signupClient.state).mockResolvedValue({
			...businessPending,
			name: "Umbrella Foundation",
			pan: "AAATU1234E",
		});
		render(<SignupWizard />);

		await findBusinessHeading();
		expect(
			screen.getByText(/verified from PAN AAATU1234E/i),
		).toBeInTheDocument();
	});

	it("falls back to this session's PAN when the server omits it", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(businessFlow);
		vi.mocked(signupClient.submitPan).mockResolvedValue({
			...businessPending,
			name: "Umbrella Foundation",
		});
		render(<SignupWizard />);

		fireEvent.change(await screen.findByLabelText(/pan/i), {
			target: { value: "AAATU1234E" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));

		await findBusinessHeading();
		expect(
			screen.getByText(/verified from PAN AAATU1234E/i),
		).toBeInTheDocument();
	});

	it("renders the Business step without a PAN when neither source has one", async () => {
		vi.mocked(signupClient.state).mockResolvedValue({
			...businessPending,
			name: "Umbrella Foundation",
		});
		render(<SignupWizard />);

		await findBusinessHeading();
		expect(screen.getByText("Umbrella Foundation")).toBeInTheDocument();
		expect(screen.queryByText(/from PAN/i)).toBeNull();
	});

	it("renders the PAN step's aside, while the rail keeps the short label", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		render(<SignupWizard />);

		await findPanHeading();
		const aside = screen.getByRole("complementary", { name: /why we ask/i });
		expect(within(aside).getByText(/why we ask/i)).toBeInTheDocument();
		expect(within(aside).getByText("Trusted since 2007")).toBeInTheDocument();

		// The card's copy and the rail's wayfinding label are different strings
		// on purpose — this is the assertion that pins that down.
		const rail = screen.getByRole("navigation", { name: /signup progress/i });
		expect(within(rail).getByText(/PAN Details, current step/)).toBeInTheDocument();
	});

	it("renders no aside for a step that does not opt in", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		render(<SignupWizard />);

		await findStepHeading("Set Secret PIN");
		// The slot is opt-in: every other step must be untouched by it.
		expect(screen.queryByRole("complementary")).toBeNull();
		expect(
			screen.getByRole("heading", { name: "Set Secret PIN", level: 3 }),
		).toBeInTheDocument();
	});
});
