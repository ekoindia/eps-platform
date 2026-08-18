import KycVerification from "@/pages/console/KycVerification";
import { EKOSTORE_URL } from "@/lib/config/features";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectInteractions = vi.fn();
const connectEkostoreToken = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: {
		connectInteractions: () => connectInteractions(),
		connectEkostoreToken: () => connectEkostoreToken(),
	},
}));

// Derived from the configured origin: `VITE_EKOSTORE_URL` differs per
// environment, so a literal here fails on any `.env` that sets it.
const GATEWAY =
	EKOSTORE_URL.replace(/\/+$/, "") + "/gateway/products/kyc-verification";

function renderPage() {
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/console/kyc-verification"]}>
				<KycVerification />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

/** The frame, by its accessible name — there is only ever one on the page. */
const frame = () => screen.queryByTitle("KYC & Verification sandbox");

beforeEach(() => {
	connectInteractions.mockReset();
	connectEkostoreToken.mockReset();
	connectEkostoreToken.mockResolvedValue({
		accessToken: "ca_full",
		expiresAt: Date.now() + 3_600_000,
	});
	resetRoleTransactionCache();
});

describe("KycVerification", () => {
	it("frames the ekostore gateway with the token on it", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 9995 }] });

		renderPage();

		await waitFor(() => expect(frame()).not.toBeNull());
		const src = new URL(frame()!.getAttribute("src") ?? "");
		expect(`${src.origin}${src.pathname}`).toBe(GATEWAY);
		expect(src.searchParams.get("access_token")).toBe("ca_full");
		// A cross-origin frame inherits no camera, and document capture needs one.
		expect(frame()).toHaveAttribute("allow", "camera");
	});

	it("offers the same URL as a new tab, for a frame that is refused", async () => {
		// ekostore refusing to be framed renders the browser's own error panel and
		// fires nothing we can catch, so the escape hatch is always on screen.
		connectInteractions.mockResolvedValue({ interactions: [{ id: 9995 }] });

		renderPage();

		const link = await screen.findByRole("link", {
			name: /open in a new tab/i,
		});
		expect(link).toHaveAttribute("href", frame()!.getAttribute("src"));
		expect(link).toHaveAttribute("target", "_blank");
		// Without noopener the opened tab can reach back through window.opener.
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("says so, and asks for nothing, without the entitlement", async () => {
		// The rail hides the item, but the route is reachable by URL — a nav item
		// is not an access control.
		connectInteractions.mockResolvedValue({ interactions: [{ id: 491 }] });

		renderPage();

		expect(
			await screen.findByText(/isn't available on this account/i),
		).toBeVisible();
		expect(connectEkostoreToken).not.toHaveBeenCalled();
		expect(frame()).toBeNull();
	});

	it("reports a refused handoff instead of spinning", async () => {
		// Entitled by the list this page read, but the backend re-checks and says
		// no. Without the failure state the user waits on a token that never lands.
		connectInteractions.mockResolvedValue({ interactions: [{ id: 9995 }] });
		connectEkostoreToken.mockRejectedValue(new Error("EKOSTORE_NOT_ENTITLED"));

		renderPage();

		expect(await screen.findByText(/couldn't open the sandbox/i)).toBeVisible();
		expect(frame()).toBeNull();
	});
});
