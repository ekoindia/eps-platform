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

/** Mirrors the component's `STAMP_INTERVAL_MS` and `SLOW_AFTER_MS`. */
const STAMP_INTERVAL_MS = 1200;
const SLOW_AFTER_MS = 8000;

/**
 * What `newClientRef` mints: 10 characters from a 32-symbol alphabet with the
 * `I`/`O`/`0`/`1` look-alikes left out, since support hears these read aloud.
 */
const REF_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;

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

/** A fetch that never settles, so the step stays in its loading panel. */
const pending = () => new Promise(() => {});

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
	it("retries the URL fetch, then shows Try again in place of both buttons", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockRejectedValue(
				new ApiError("STEP_FAILED", "Couldn't prepare it", 400),
			);
			renderStep();

			await tick(RETRY_DELAYS_MS[0]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(2);
			expect(screen.queryByText(/couldn't prepare it/i)).toBeNull();

			await tick(RETRY_DELAYS_MS[1]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(3);

			// One more flush: the third rejection still has to travel back out
			// through `withRetries` before `initialize` can render it.
			await tick(0);
			expect(
				screen.getByText(/something broke on our side/i),
			).toBeInTheDocument();
			expect(screen.getByText(/couldn't prepare it/i)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /try again/i }),
			).toBeInTheDocument();
			// The whole point of the error state: neither action is offered.
			expect(
				screen.queryByRole("button", { name: /read and sign the agreement/i }),
			).toBeNull();
			expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
		});
	});

	// All three retry attempts must quote the SAME reference: one attempt by the
	// user is one reference, whatever `withRetries` does underneath.
	it("sends one generated reference with every attempt and shows it on failure", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockRejectedValue(
				new ApiError("STEP_FAILED", "Couldn't prepare it", 400),
			);
			vi.spyOn(console, "error").mockImplementation(() => {});
			renderStep();
			await tick(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1]);
			await tick(0);

			const refs = getAgreementUrl.mock.calls.map(([ref]) => ref);
			expect(refs).toHaveLength(3);
			expect(refs[0]).toMatch(REF_PATTERN);
			expect(new Set(refs).size).toBe(1);

			expect(screen.getByText(`REF ${refs[0]}`)).toBeInTheDocument();
			expect(
				screen.getByText(new RegExp(`quote reference ${refs[0]}`)),
			).toBeInTheDocument();
		});
	});

	it("mints a fresh reference and clears the wait when Try again is clicked", async () => {
		await withFakeTimers(async () => {
			let rejectFirst: (e: unknown) => void = () => {};
			getAgreementUrl
				.mockReturnValueOnce(
					new Promise((_resolve, reject) => {
						rejectFirst = reject;
					}),
				)
				.mockReturnValue(pending());
			vi.spyOn(console, "error").mockImplementation(() => {});
			renderStep();

			// Long enough for the checklist to tick and the slow copy to appear.
			await tick(SLOW_AFTER_MS);
			expect(screen.getByText(/slower than usual/i)).toBeInTheDocument();
			expect(screen.getByText("✓ Registered name")).toBeInTheDocument();

			// INVALID_INPUT is non-retryable, so this lands on the error panel at once.
			await act(async () => {
				rejectFirst(new ApiError("INVALID_INPUT", "nope", 400));
			});
			const firstRef = getAgreementUrl.mock.calls[0][0];
			expect(screen.getByText(`REF ${firstRef}`)).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /try again/i }));
			await settle();

			// The second attempt opens clean — this is the regression the reset guards.
			expect(screen.queryByText(/slower than usual/i)).toBeNull();
			expect(screen.queryByText("✓ Registered name")).toBeNull();
			expect(getAgreementUrl.mock.calls[1][0]).toMatch(REF_PATTERN);
			expect(getAgreementUrl.mock.calls[1][0]).not.toBe(firstRef);
		});
	});

	// The copy promises one retry usually fixes this, so the first failure must
	// point at the button, not at a human.
	it("offers support only once a retry has failed too", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockRejectedValue(
				new ApiError("INVALID_INPUT", "nope", 400),
			);
			vi.spyOn(console, "error").mockImplementation(() => {});
			renderStep();
			await settle();

			expect(screen.queryByRole("link", { name: /whatsapp/i })).toBeNull();
			expect(screen.getByText(/if the second attempt fails too/i)).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /try again/i }));
			await settle();

			expect(
				screen.getByRole("link", { name: /talk to support on whatsapp/i }),
			).toBeInTheDocument();
			expect(screen.queryByText(/if the second attempt fails too/i)).toBeNull();
			expect(screen.getByText(/^Quote reference/)).toBeInTheDocument();
		});
	});

	it("ticks the stamped fields while the fetch is in flight, never the last one", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockReturnValue(pending());
			renderStep();

			expect(screen.getByText("Registered name…")).toBeInTheDocument();

			await tick(STAMP_INTERVAL_MS);
			expect(screen.getByText("✓ Registered name")).toBeInTheDocument();
			expect(screen.getByText("Registered address…")).toBeInTheDocument();

			await tick(STAMP_INTERVAL_MS);
			expect(screen.getByText("✓ Registered address")).toBeInTheDocument();

			// The last field completes when the document does, so it must stay
			// pending however long the wait runs. Asserted by position, not by name,
			// so editing the STAMPED_FIELDS copy cannot quietly break this.
			await tick(STAMP_INTERVAL_MS * 5);
			const fields = screen.getAllByRole("listitem");
			expect(fields.length).toBeGreaterThan(1);
			expect(fields.at(-1)?.textContent).toMatch(/…$/);
			for (const done of fields.slice(0, -1)) {
				expect(done.textContent).toMatch(/^✓ /);
			}
		});
	});

	it("admits the wait is slow only after it actually is", async () => {
		await withFakeTimers(async () => {
			getAgreementUrl.mockReturnValue(pending());
			renderStep();

			await tick(SLOW_AFTER_MS - 1000);
			expect(screen.queryByText(/slower than usual/i)).toBeNull();

			await tick(1000);
			expect(screen.getByText(/slower than usual/i)).toBeInTheDocument();
		});
	});

	it("names the document, the profile it was prepared for, and its id", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		renderStep();
		expect(
			await screen.findByText("Eko Platform Services Agreement"),
		).toBeInTheDocument();
		expect(screen.getByText(BUSINESS)).toBeInTheDocument();
		expect(screen.getByText(/DOC9/)).toBeInTheDocument();
		expect(screen.getByText(/document ready/i)).toBeInTheDocument();
	});

	it("hands the sample agreement to ChatGPT for an explanation", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		renderStep();
		const link = await screen.findByRole("link", { name: /explain with ai/i });
		const href = link.getAttribute("href") ?? "";
		expect(href.startsWith("https://chatgpt.com/?q=")).toBe(true);
		expect(decodeURIComponent(href)).toContain(
			"https://eps.eko.in/samples/partner-agreement",
		);
		// The only link in the panel — reading the real document is what the CTA
		// does, so a "read a sample" link beside it would just be a worse copy.
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it("drops the name clause when the profile has none", async () => {
		getAgreementUrl.mockResolvedValue(READY);
		renderStep({}, { mobile: "9876543210", name: "  " });
		expect(
			await screen.findByText("Eko Platform Services Agreement"),
		).toBeInTheDocument();
		expect(screen.queryByText(/prepared for/i)).toBeNull();
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

			expect(screen.getByText(/^signed$/i)).toBeInTheDocument();
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

			fireEvent.click(
				screen.getByRole("button", { name: /read and sign the agreement/i }),
			);
			expect(openEsign).toHaveBeenCalled();
			expect(screen.getByText(/^signed$/i)).toBeInTheDocument();

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
			await screen.findByRole("button", {
				name: /read and sign the agreement/i,
			}),
		);
		expect(await screen.findByText(/allow pop-ups/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /read and sign the agreement/i }),
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
					screen.getByRole("button", { name: /read and sign the agreement/i }),
				);

				// Without this the step used to sit in `signing` with no way forward
				// — but not before the signing tab has had time to paint.
				expect(
					screen.getByRole("button", { name: /continue/i }),
				).toBeDisabled();
				expect(
					screen.getByText(/you can continue in 5 seconds/i),
				).toBeInTheDocument();

				await runGrace();
				expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
				expect(screen.queryByText(/you can continue in/i)).toBeNull();
				// Both actions, never one instead of the other: a user who closed the
				// popup needs the reopen, and one who signed needs Continue.
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
					screen.getByRole("button", { name: /read and sign the agreement/i }),
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
				await screen.findByRole("button", {
					name: /read and sign the agreement/i,
				}),
			);
			postStatusUpdate("https://evil.example");
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("ignores a STATUS_UPDATE before any signing window is opened", async () => {
			const onSubmit = vi.fn().mockResolvedValue(undefined);
			renderStep({ onSubmit });
			await screen.findByRole("button", {
				name: /read and sign the agreement/i,
			});
			postStatusUpdate("https://sign.example");
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});
});
