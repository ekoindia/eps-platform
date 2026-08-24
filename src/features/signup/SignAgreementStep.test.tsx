import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RETRY_DELAYS_MS } from "@/lib/retry";

const getAgreementUrl = vi.fn();
const submitAgreement = vi.fn();
const openEsign = vi.fn();

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
	usesLeegality: () => true, // default to the SDK flow (no popup listener)
	esignOrigin: () => "https://sign.example",
}));

import { ApiError } from "@/lib/auth/client";
import { SignAgreementStep } from "./SignAgreementStep";

const noop = async () => {};

beforeEach(() => {
	getAgreementUrl.mockReset();
	submitAgreement.mockReset();
	openEsign.mockReset();
});

describe("SignAgreementStep", () => {
	// A bare STEP_FAILED reads as a transient upstream blip, so `withRetries`
	// spends all three attempts before the user is told anything. Fake timers keep
	// that 4s of backoff out of the suite's wall clock.
	it("retries the URL fetch, then shows an error and a retry", async () => {
		vi.useFakeTimers();
		try {
			getAgreementUrl.mockRejectedValue(
				new ApiError("STEP_FAILED", "Couldn't prepare it", 400),
			);
			render(<SignAgreementStep onSubmit={noop} busy={false} error={null} />);

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(2);
			expect(screen.queryByText(/couldn't prepare it/i)).toBeNull();

			await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
			expect(getAgreementUrl).toHaveBeenCalledTimes(3);

			// One more flush: the third rejection still has to travel back out
			// through `withRetries` before `initialize` can render it.
			await vi.advanceTimersByTimeAsync(0);
			expect(screen.getByText(/couldn't prepare it/i)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /try again/i }),
			).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it("jumps straight to Continue when the agreement is already signed", async () => {
		getAgreementUrl.mockResolvedValue({
			shortUrl: "",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: true,
		});
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<SignAgreementStep onSubmit={onSubmit} busy={false} error={null} />);
		expect(await screen.findByText(/already signed/i)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({ document_id: "DOC9" });
	});

	it("signs, then submits the document id from the provider callback", async () => {
		getAgreementUrl.mockResolvedValue({
			shortUrl: "https://sign.example/x",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: false,
		});
		openEsign.mockImplementation(
			(_url: string, _pipe: number, cb: (o: { documentId?: string }) => void) =>
				cb({ documentId: "DOC-SDK" }),
		);
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<SignAgreementStep onSubmit={onSubmit} busy={false} error={null} />);
		fireEvent.click(
			await screen.findByRole("button", { name: /sign agreement/i }),
		);
		expect(openEsign).toHaveBeenCalled();
		fireEvent.click(await screen.findByRole("button", { name: /continue/i }));
		// The Leegality callback's id wins over the fetched one.
		expect(onSubmit).toHaveBeenCalledWith({ document_id: "DOC-SDK" });
	});

	it("surfaces a provider error and keeps the Sign button", async () => {
		getAgreementUrl.mockResolvedValue({
			shortUrl: "https://sign.example/x",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: false,
		});
		openEsign.mockImplementation(
			(_url: string, _pipe: number, cb: (o: { error?: string }) => void) =>
				cb({ error: "Please allow pop-ups to sign." }),
		);
		render(<SignAgreementStep onSubmit={noop} busy={false} error={null} />);
		fireEvent.click(
			await screen.findByRole("button", { name: /sign agreement/i }),
		);
		expect(await screen.findByText(/allow pop-ups/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /sign agreement/i }),
		).toBeInTheDocument();
	});
});
