import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RETRY_DELAYS_MS } from "@/lib/retry";

const getAgreementUrl = vi.fn();
const submitAgreement = vi.fn();
const openEsign = vi.fn();
// Flipped per-test: the SDK pipes (1/3) and the popup pipes (0/2) take entirely
// different completion paths, and only the SDK one used to be covered.
let leegality = true;

vi.mock("@/lib/auth/client", () => {
	class ApiError extends Error {
		code: string;
		httpStatus: number;
		constructor(code: string, message: string, httpStatus: number) {
			super(message);
			this.code = code;
			this.httpStatus = httpStatus;
		}
	}
	return {
		ApiError,
		signupClient: {
			getAgreementUrl: (...a: unknown[]) => getAgreementUrl(...a),
			submitAgreement: (...a: unknown[]) => submitAgreement(...a),
		},
	};
});

vi.mock("./esign", () => ({
	openEsign: (...a: unknown[]) => openEsign(...a),
	usesLeegality: () => leegality,
	esignOrigin: () => "https://sign.example",
}));

import { ApiError } from "@/lib/auth/client";
import { SignAgreementStep } from "./SignAgreementStep";
import {
	type SignupProfile,
	SignupProfileProvider,
} from "./SignupProfileContext";

const noop = async () => {};

const BUSINESS = "MIF TECHNOLOGIES PRIVATE LIMITED";

/** The step reads the profile from context, so every case needs the provider. */
const renderStep = (
	props: Partial<React.ComponentProps<typeof SignAgreementStep>> = {},
	profile: SignupProfile = { mobile: "9876543210", name: BUSINESS },
) =>
	render(
		<SignupProfileProvider profile={profile}>
			<SignAgreementStep onSubmit={noop} busy={false} error={null} {...props} />
		</SignupProfileProvider>,
	);

const READY = {
	shortUrl: "https://sign.example/x",
	documentId: "DOC9",
	pipe: 3,
	alreadySigned: false,
};

/** Mirrors the component's `POPUP_GRACE_SECONDS`. */
const POPUP_GRACE_SECONDS = 5;

/** Runs `body` on fake timers, always restoring real ones. */
const withFakeTimers = async (body: () => Promise<void>) => {
	vi.useFakeTimers();
	try {
		await body();
	} finally {
		vi.useRealTimers();
	}
};

/** Advances fake time inside `act`, so the resulting effects flush before asserting. */
const tick = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});

/** Flushes the mounted `getAgreementUrl` promise without burning a countdown tick. */
const settle = () => tick(0);

/**
 * Runs the popup grace period out. One second at a time on purpose: React arms
 * the next timeout from an effect that only runs *after* an advance returns, so
 * a single `advanceTimersByTime(5000)` would tick the counter just once.
 */
const runGrace = async () => {
	for (let i = 0; i < POPUP_GRACE_SECONDS; i++) await tick(1000);
};

/** Dispatches the completion message a popup signing page posts back. */
const postStatusUpdate = (origin: string) =>
	fireEvent(
		window,
		new MessageEvent("message", { data: { type: "STATUS_UPDATE" }, origin }),
	);

beforeEach(() => {
	getAgreementUrl.mockReset();
	submitAgreement.mockReset();
	openEsign.mockReset();
	leegality = true;
});

describe("SignAgreementStep", () => {
	// A bare STEP_FAILED reads as a transient upstream blip, so `withRetries`
	// spends all three attempts before the user is told anything. Fake timers keep
	// that 4s of backoff out of the suite's wall clock.
	it("retries the URL fetch, then shows a retry in place of both buttons", async () => {
		vi.useFakeTimers();
		try {
			getAgreementUrl.mockRejectedValue(
				new ApiError("STEP_FAILED", "Couldn't prepare it", 400),
			);
			renderStep();

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(2);
			expect(screen.queryByText(/couldn't prepare it/i)).toBeNull();

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(3);

			// One more flush: the third rejection still has to travel back out
			// through `withRetries` before `initialize` can render it.
			await vi.advanceTimersByTimeAsync(0);
			expect(
				screen.getByText(/failed to prepare document/i),
			).toBeInTheDocument();
			expect(screen.getByText(/couldn't prepare it/i)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /retry/i }),
			).toBeInTheDocument();
			// The whole point of the error state: neither action is offered.
			expect(
				screen.queryByRole("button", { name: /sign agreement/i }),
			).toBeNull();
			expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("names the profile and the document it generated", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		renderStep();
		expect(
			await screen.findByText(`Document is generated for ${BUSINESS}`),
		).toBeInTheDocument();
		expect(screen.getByText("Document ID: DOC9")).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
	});

	it("drops the name clause when the profile has none", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		renderStep({}, { mobile: "9876543210", name: "  " });
		expect(
			await screen.findByText("Document is generated"),
		).toBeInTheDocument();
	});

	it("submits at once when the agreement is already signed", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockResolvedValue({
				shortUrl: "",
				documentId: "DOC9",
				pipe: 3,
				alreadySigned: true,
			});
			const onSubmit = vi.fn().mockResolvedValue(undefined);
			renderStep({ onSubmit });
			await settle();

			expect(screen.getByText(/already signed/i)).toBeInTheDocument();
			// No grace period on a signal: nothing was opened to wait for.
			expect(onSubmit).toHaveBeenCalledWith({ document_id: "DOC9" });
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});
	});

	it("submits the document id from the provider callback without a click", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockResolvedValue(READY);
			openEsign.mockImplementation(
				(
					_url: string,
					_pipe: number,
					cb: (o: { documentId?: string }) => void,
				) => cb({ documentId: "DOC-SDK" }),
			);
			const onSubmit = vi.fn().mockResolvedValue(undefined);
			renderStep({ onSubmit });
			await settle();

			fireEvent.click(screen.getByRole("button", { name: /sign agreement/i }));
			expect(openEsign).toHaveBeenCalled();
			expect(screen.getByText("Completed")).toBeInTheDocument();

			// The SDK callback is a real completion signal — no waiting, and the
			// callback's id wins over the fetched one.
			expect(onSubmit).toHaveBeenCalledWith({ document_id: "DOC-SDK" });
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});
	});

	it("surfaces a provider error and keeps the Sign button", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		openEsign.mockImplementation(
			(_url: string, _pipe: number, cb: (o: { error?: string }) => void) =>
				cb({ error: "Please allow pop-ups to sign." }),
		);
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		renderStep({ onSubmit });
		fireEvent.click(
			await screen.findByRole("button", { name: /sign agreement/i }),
		);
		expect(await screen.findByText(/allow pop-ups/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /sign agreement/i }),
		).toBeEnabled();
		expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	describe("popup providers", () => {
		// No SDK callback exists for these, so `openEsign` opens the window and
		// returns without ever reporting an outcome.
		beforeEach(() => {
			leegality = false;
			getAgreementUrl.mockResolvedValue({ ...READY, pipe: 2 });
			openEsign.mockImplementation(() => Promise.resolve());
		});

		it("offers Continue once the signing window is open, after a grace period", async () => {
			await withFakeTimers(async () => {
				renderStep();
				await settle();
				fireEvent.click(
					screen.getByRole("button", { name: /sign agreement/i }),
				);

				// Without this the step used to sit in `signing` with no way forward
				// — but not before the signing tab has had time to paint.
				expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
				expect(
					screen.getByText(/you can continue in 5 seconds/i),
				).toBeInTheDocument();

				await runGrace();
				expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
				expect(screen.queryByText(/you can continue in/i)).toBeNull();
				expect(
					screen.getByRole("button", {
						name: /open the signing window again/i,
					}),
				).toBeEnabled();
			});
		});

		it("continues at once on a STATUS_UPDATE from the signing origin", async () => {
			await withFakeTimers(async () => {
				const onSubmit = vi.fn().mockResolvedValue(undefined);
				renderStep({ onSubmit });
				await settle();

				fireEvent.click(
					screen.getByRole("button", { name: /sign agreement/i }),
				);
				postStatusUpdate("https://sign.example");

				// The signal beats the grace period: no waiting, no click.
				expect(onSubmit).toHaveBeenCalledWith({ document_id: "DOC9" });
				// A second message must not re-fire the submit.
				postStatusUpdate("https://sign.example");
				expect(onSubmit).toHaveBeenCalledTimes(1);
			});
		});

		it("ignores a STATUS_UPDATE from another origin", async () => {
			const onSubmit = vi.fn().mockResolvedValue(undefined);
			renderStep({ onSubmit });
			fireEvent.click(
				await screen.findByRole("button", { name: /sign agreement/i }),
			);
			postStatusUpdate("https://evil.example");
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("ignores a STATUS_UPDATE before any signing window is opened", async () => {
			const onSubmit = vi.fn().mockResolvedValue(undefined);
			renderStep({ onSubmit });
			await screen.findByRole("button", { name: /sign agreement/i });
			postStatusUpdate("https://sign.example");
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});
});
