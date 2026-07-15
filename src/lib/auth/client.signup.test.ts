import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, signupClient } from "./client";

const state = {
	mobile: "9990000001",
	status: "in_progress" as const,
	steps: [{ role: 13000, label: "PAN Details" }],
	currentRole: 13000,
};

/**
 * Stubs global fetch with one JSON response and returns the call spy. Builds a
 * fresh Response per call — a real Response's body can only be read once, and
 * some tests below call the client more than once against the same stub.
 */
function stubFetch(body: unknown, status = 200) {
	const spy = vi.fn().mockImplementation(
		async () =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
	);
	vi.stubGlobal("fetch", spy);
	return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("signupClient", () => {
	it("state() GETs /signup/state with credentials", async () => {
		const spy = stubFetch(state);
		expect(await signupClient.state()).toEqual(state);
		const [url, init] = spy.mock.calls[0];
		expect(String(url)).toContain("/signup/state");
		expect(init.method).toBe("GET");
		expect(init.credentials).toBe("include");
	});

	it("createProfile() POSTs /signup/profile", async () => {
		const spy = stubFetch(state);
		await signupClient.createProfile();
		const [url, init] = spy.mock.calls[0];
		expect(String(url)).toContain("/signup/profile");
		expect(init.method).toBe("POST");
	});

	it("submitPan() POSTs the pan", async () => {
		const spy = stubFetch(state);
		await signupClient.submitPan("ABCDE1234F");
		const [, init] = spy.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({ pan: "ABCDE1234F" });
	});

	it("submitPin() POSTs both pins", async () => {
		const spy = stubFetch(state);
		await signupClient.submitPin("1234", "1234");
		const [, init] = spy.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({ pin1: "1234", pin2: "1234" });
	});

	it("throws ApiError carrying the backend message", async () => {
		stubFetch({ error: { code: "STEP_FAILED", message: "PAN already in use" } }, 400);
		await expect(signupClient.submitPan("ABCDE1234F")).rejects.toThrow(
			"PAN already in use",
		);
		try {
			await signupClient.submitPan("ABCDE1234F");
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
			expect((e as ApiError).code).toBe("STEP_FAILED");
		}
	});
});
