import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import TestApis from "@/pages/console/TestApis";
import { render, screen, waitFor } from "@testing-library/react";
import { createHmac } from "node:crypto";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectInteractions = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectInteractions: () => connectInteractions() },
}));

// Module constant read at import, so it cannot be set through import.meta.env:
// without it `useRoleTransactionList` never fetches and the Live Sandbox callout
// could never appear, making its "hidden" assertions vacuously true.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_CONNECT_WIDGET: true,
}));

/** Independent reference signer — same one `SecretKeyTester.test.tsx` pins to. */
const ref = (message: string, accessKey: string): string =>
	createHmac("sha256", Buffer.from(accessKey).toString("base64"))
		.update(message)
		.digest("base64");

const DEV_KEY = "dev-key-123";
const ACCESS_KEY = "access-key-456";

const SANDBOX_LINK = /Live Sandbox \(KYC & Verification\)/;

function renderPage() {
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/console/uat-sandbox"]}>
				<TestApis />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

/** The keypair the page is built around, present unless a test says otherwise. */
const stubKeys = () => {
	vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", DEV_KEY);
	vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", ACCESS_KEY);
};

describe("TestApis", () => {
	beforeEach(() => {
		resetRoleTransactionCache();
		connectInteractions.mockResolvedValue({ interactions: [] });
	});
	afterEach(() => vi.unstubAllEnvs());

	it("shows the UAT keypair", () => {
		stubKeys();
		renderPage();
		expect(screen.getByText(DEV_KEY)).toBeInTheDocument();
		expect(screen.getByText(ACCESS_KEY)).toBeInTheDocument();
	});

	// The point of the page: land on a copyable signature, no clicks. This is the
	// wiring a component-level prop test cannot catch — the page has to actually
	// pass the configured access key down to the signer.
	it("prefills the signer with the UAT access key and signs on load", async () => {
		stubKeys();
		renderPage();
		const accessKey = screen.getByLabelText("Access Key (auth key)");
		expect(accessKey).toHaveValue(ACCESS_KEY);
		const timestamp = screen.getByLabelText(
			"Timestamp (milliseconds)",
		) as HTMLInputElement;
		await waitFor(() => expect(timestamp.value).not.toBe(""));
		expect(
			await screen.findByText(ref(timestamp.value, ACCESS_KEY)),
		).toBeInTheDocument();
	});

	it("says so, and still renders the signer, when no UAT keypair is configured", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");
		renderPage();
		expect(
			screen.getByText(/No UAT keypair is configured for this build/i),
		).toBeInTheDocument();
		// Empty, not absent: a developer with their own key can still sign here.
		expect(screen.getByLabelText("Access Key (auth key)")).toHaveValue("");
		expect(screen.queryByText(/test keys below/i)).toBeNull();
	});

	it("offers the three testing routes, with a downloadable Postman collection", () => {
		stubKeys();
		renderPage();
		expect(
			screen.getByRole("link", { name: /Integration Docs/ }),
		).toHaveAttribute("href", "/docs");
		const postman = screen.getByRole("link", {
			name: /Download the Postman collection/,
		});
		expect(postman).toHaveAttribute(
			"href",
			"/agent/eps.postman_collection.json",
		);
		// Without `download` the browser renders the JSON instead of saving it.
		expect(postman).toHaveAttribute("download");
	});

	it("keeps the console out of the index", async () => {
		stubKeys();
		renderPage();
		await waitFor(() =>
			expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
				"content",
				"noindex,nofollow",
			),
		);
	});

	describe("Live Sandbox callout", () => {
		it("links to the sandbox when 9995 is entitled", async () => {
			stubKeys();
			connectInteractions.mockResolvedValue({ interactions: [{ id: 9995 }] });
			renderPage();
			expect(
				await screen.findByRole("link", { name: SANDBOX_LINK }),
			).toHaveAttribute("href", "/console/kyc-verification");
		});

		it("stays hidden without the entitlement", async () => {
			stubKeys();
			renderPage();
			// Settle the fetch first, or this passes merely because nothing resolved.
			await waitFor(() => expect(connectInteractions).toHaveBeenCalled());
			await waitFor(() =>
				expect(screen.queryByRole("link", { name: SANDBOX_LINK })).toBeNull(),
			);
		});

		// Fail closed: an unresolved or failed list is not an entitlement, and a
		// link that resolves to "isn't available on this account" is worse than none.
		it("stays hidden while the entitlement list is unresolved", () => {
			stubKeys();
			connectInteractions.mockReturnValue(new Promise(() => undefined));
			renderPage();
			expect(screen.queryByRole("link", { name: SANDBOX_LINK })).toBeNull();
		});

		it("stays hidden when the entitlement list cannot be read", async () => {
			stubKeys();
			connectInteractions.mockRejectedValue(new Error("upstream down"));
			renderPage();
			await waitFor(() => expect(connectInteractions).toHaveBeenCalled());
			expect(screen.queryByRole("link", { name: SANDBOX_LINK })).toBeNull();
		});
	});
});
