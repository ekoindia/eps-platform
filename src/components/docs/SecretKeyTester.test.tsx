import { SecretKeyTester } from "@/components/docs/SecretKeyTester";
import { API_AUTH_INFO } from "@/lib/data/api-auth";
import { computeSecretKey } from "@/lib/docs/eko-signing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Spy on the real signer so individual tests can force a rejection. */
vi.mock("@/lib/docs/eko-signing", async (orig) => {
	const actual = await orig<typeof import("@/lib/docs/eko-signing")>();
	return { ...actual, computeSecretKey: vi.fn(actual.computeSecretKey) };
});

/** Independent reference implementation using Node's crypto. */
const ref = (message: string, accessKey: string): string =>
	createHmac("sha256", Buffer.from(accessKey).toString("base64"))
		.update(message)
		.digest("base64");

const ACCESS_KEY = "test-access-key-123";
const TIMESTAMP = "1700000000000";
const GOLDEN = ref(TIMESTAMP, ACCESS_KEY);

// Exact labels: a loose /access key/i also matches the reveal button's
// aria-label ("Show access key").
const accessKeyInput = () => screen.getByLabelText("Access Key (auth key)");
const timestampInput = () => screen.getByLabelText("Timestamp (milliseconds)");
const expectedInput = () => screen.getByLabelText("Signature to check");

/** Fill both signing inputs with the golden vector. */
const enterGoldenInputs = () => {
	fireEvent.change(accessKeyInput(), { target: { value: ACCESS_KEY } });
	fireEvent.change(timestampInput(), { target: { value: TIMESTAMP } });
};

/** The real signer, so a test that swaps it out cannot leak into the next. */
const realCompute = vi.mocked(computeSecretKey).getMockImplementation();

describe("SecretKeyTester", () => {
	beforeEach(() => {
		vi.mocked(computeSecretKey).mockReset().mockImplementation(realCompute!);
	});

	it("computes the documented signature for an access key + timestamp", async () => {
		render(<SecretKeyTester />);
		enterGoldenInputs();
		expect(await screen.findByText(GOLDEN)).toBeInTheDocument();
	});

	it("masks the access key until it is revealed", () => {
		render(<SecretKeyTester />);
		expect(accessKeyInput()).toHaveAttribute("type", "password");
		fireEvent.click(screen.getByLabelText("Show access key"));
		expect(accessKeyInput()).toHaveAttribute("type", "text");
	});

	it("clears a stale signature when the inputs stop being signable", async () => {
		render(<SecretKeyTester />);
		enterGoldenInputs();
		expect(await screen.findByText(GOLDEN)).toBeInTheDocument();

		fireEvent.change(timestampInput(), { target: { value: "17000000000x" } });
		await waitFor(() => expect(screen.queryByText(GOLDEN)).toBeNull());
		expect(screen.getByText(/Digits only/i)).toBeInTheDocument();

		fireEvent.change(timestampInput(), { target: { value: TIMESTAMP } });
		fireEvent.change(accessKeyInput(), { target: { value: "" } });
		await waitFor(() => expect(screen.queryByText(GOLDEN)).toBeNull());
	});

	it("stays undecided until both signatures exist, then reports a match", async () => {
		render(<SecretKeyTester />);
		// No inputs at all: neither verdict may be shown.
		expect(screen.queryByText(/Signatures match/i)).toBeNull();
		expect(screen.queryByText(/No match/i)).toBeNull();

		enterGoldenInputs();
		await screen.findByText(GOLDEN);
		// A computed signature alone is still not a verdict.
		expect(screen.queryByText(/No match/i)).toBeNull();

		fireEvent.change(expectedInput(), { target: { value: ` ${GOLDEN} ` } });
		expect(await screen.findByText(/Signatures match/i)).toBeInTheDocument();
	});

	// The same vector the agent bundle publishes and `debug_auth` returns. If it
	// ever stops self-verifying here, the value we hand to AI agents is wrong.
	it("self-verifies the published test vector in one click", async () => {
		render(<SecretKeyTester />);
		fireEvent.click(screen.getByText(/Load the published test vector/i));
		expect(await screen.findByText(/Signatures match/i)).toBeInTheDocument();
		expect(
			screen.getByText(API_AUTH_INFO.testVector.secretKey),
		).toBeInTheDocument();
	});

	it("reports a mismatch with the usual causes", async () => {
		render(<SecretKeyTester />);
		enterGoldenInputs();
		await screen.findByText(GOLDEN);

		fireEvent.change(expectedInput(), { target: { value: "not-the-key=" } });
		expect(await screen.findByText(/No match/i)).toBeInTheDocument();
		expect(screen.getByText(/decoded bytes/i)).toBeInTheDocument();
	});

	it("ignores a stale in-flight result that resolves after a newer one", async () => {
		let resolveFirst: (value: string) => void = () => {};
		vi.mocked(computeSecretKey)
			.mockImplementationOnce(
				() =>
					new Promise<string>((resolve) => {
						resolveFirst = resolve;
					}),
			)
			.mockImplementationOnce(() => Promise.resolve("SECOND-SIGNATURE"));

		render(<SecretKeyTester />);
		fireEvent.change(timestampInput(), { target: { value: TIMESTAMP } });
		fireEvent.change(accessKeyInput(), { target: { value: "a" } });
		fireEvent.change(accessKeyInput(), { target: { value: "ab" } });

		expect(await screen.findByText("SECOND-SIGNATURE")).toBeInTheDocument();
		resolveFirst("FIRST-SIGNATURE");
		await waitFor(() =>
			expect(screen.getByText("SECOND-SIGNATURE")).toBeInTheDocument(),
		);
		expect(screen.queryByText("FIRST-SIGNATURE")).toBeNull();
	});

	it("explains a failure instead of rendering a signature when signing throws", async () => {
		vi.mocked(computeSecretKey).mockRejectedValue(
			new TypeError("crypto.subtle is undefined"),
		);
		render(<SecretKeyTester />);
		enterGoldenInputs();
		expect(
			await screen.findByText(/Web Crypto is unavailable/i),
		).toBeInTheDocument();
		expect(screen.queryByText(GOLDEN)).toBeNull();
	});
});
