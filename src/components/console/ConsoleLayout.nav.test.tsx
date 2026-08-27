import ConsoleLayout from "@/components/console/ConsoleLayout";
import type { AuthState } from "@/lib/auth/AuthProvider";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectInteractions = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectInteractions: () => connectInteractions() },
}));

// Module constant read at import, so it has to be mocked rather than stubbed
// through import.meta.env.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_CONNECT_WIDGET: true,
}));

const DEVELOPER: AuthState = {
	status: "authed",
	role: "developer",
	me: { state: "active", mobile: "999", profile: null, zohoId: null },
};

vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: DEVELOPER, refresh: vi.fn(), logout: vi.fn() }),
	useOptionalAuth: () => ({
		state: DEVELOPER,
		refresh: vi.fn(),
		logout: vi.fn(),
	}),
}));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
// The rail's own wallet card is covered by WalletBalance.connect.test.tsx.
vi.mock("@/components/console/WalletBalance", () => ({
	WalletBalance: () => <div>wallet-balance</div>,
}));

function renderRail() {
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/console"]}>
				<Routes>
					<Route path="/console" element={<ConsoleLayout />}>
						<Route index element={<div>home-page</div>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</HelmetProvider>,
	);
}

beforeEach(() => {
	connectInteractions.mockReset();
	resetRoleTransactionCache();
});

/** Rail labels in render order, minus the DEV-only bench. */
function railLabels(): (string | undefined)[] {
	return screen
		.getAllByRole("link")
		.map((a) => a.textContent?.trim())
		.filter((l) => l !== "Test bench");
}

describe("ConsoleLayout — Load Wallet rail item", () => {
	it("links to the entitled flow, heading Account & History", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 491, interaction_type_id: 0, behavior: 7 }],
		});

		renderRail();

		const link = await screen.findByRole("link", { name: "Load Wallet" });
		expect(link).toHaveAttribute("href", "/console/transaction/491");
		// Opens the last section, immediately ahead of Transaction History.
		const labels = railLabels();
		expect(labels.indexOf("Transaction History")).toBe(
			labels.indexOf("Load Wallet") + 1,
		);
	});

	it("sits behind the KYC and Build sections when all are entitled", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 491 }, { id: 586 }, { id: 587 }],
		});

		renderRail();

		await screen.findByRole("link", { name: "Load Wallet" });
		// KYC blocks the account, so it outranks everything; Build follows; the
		// day-to-day account items close the rail.
		expect(railLabels()).toEqual([
			"Home",
			"Upload Documents",
			"Credentials",
			"API Docs",
			"Load Wallet",
			"Transaction History",
		]);
	});

	it("stays hidden when the user may not load E-value", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 154, interaction_type_id: 154 }],
		});

		renderRail();

		expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
		await waitFor(() =>
			expect(screen.queryByRole("link", { name: "Load Wallet" })).toBeNull(),
		);
	});
});

describe("ConsoleLayout — self-service flow rail items", () => {
	it("shows AePS Agents after Manage My Account, only when 36 is entitled", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 36 }, { id: 536 }],
		});

		renderRail();

		expect(
			await screen.findByRole("link", { name: "AePS Agents" }),
		).toHaveAttribute("href", "/console/transaction/36");
		const labels = railLabels();
		expect(labels.indexOf("AePS Agents")).toBe(
			labels.indexOf("Manage My Account") + 1,
		);
	});

	it("hides AePS Agents when 36 is not entitled", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 491 }] });

		renderRail();

		expect(
			await screen.findByRole("link", { name: "Credentials" }),
		).toBeVisible();
		await waitFor(() =>
			expect(screen.queryByRole("link", { name: "AePS Agents" })).toBeNull(),
		);
	});

	it("closes the KYC section with Sign Agreement and the rail with Manage My Account", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 491 }, { id: 898 }, { id: 536 }],
		});

		renderRail();

		expect(
			await screen.findByRole("link", { name: "Sign Agreement" }),
		).toHaveAttribute("href", "/console/transaction/898");
		expect(
			screen.getByRole("link", { name: "Manage My Account" }),
		).toHaveAttribute("href", "/console/transaction/536");
		// Sign Agreement is onboarding, so it rides in the first section even
		// without the document upload beside it.
		expect(railLabels()).toEqual([
			"Home",
			"Sign Agreement",
			"Credentials",
			"API Docs",
			"Load Wallet",
			"Transaction History",
			"Manage My Account",
		]);
	});

	it("hides a flow the user is not entitled to", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 898 }] });

		renderRail();

		await screen.findByRole("link", { name: "Sign Agreement" });
		expect(
			screen.queryByRole("link", { name: "Manage My Account" }),
		).toBeNull();
	});
});

describe("ConsoleLayout — ekostore KYC sandbox rail item", () => {
	const NAME = "Live Sandbox (KYC & Verification)";

	it("links to the in-app sandbox page, closing the Build section", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 9995 }] });

		renderRail();

		// An internal route now: the gateway is framed by that page, which is also
		// where the access token is minted.
		const link = await screen.findByRole("link", { name: NAME });
		expect(link).toHaveAttribute("href", "/console/kyc-verification");
		expect(link).not.toHaveAttribute("target");

		// Adjacency, not absolute position: whichever account items the caller is
		// entitled to follow this one, so a whole-list compare would break on
		// nothing.
		const labels = railLabels();
		expect(labels.indexOf(NAME)).toBe(labels.indexOf("API Docs") + 1);
	});

	it("stays hidden without the entitlement", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 491 }] });

		renderRail();

		expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
		await waitFor(() =>
			expect(screen.queryByRole("link", { name: NAME })).toBeNull(),
		);
	});

	it("stays hidden when the entitlement list cannot be read", async () => {
		// Fail closed: an entitlement we could not read is not an entitlement.
		connectInteractions.mockRejectedValue(new Error("upstream down"));

		renderRail();

		expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
		await waitFor(() =>
			expect(screen.queryByRole("link", { name: NAME })).toBeNull(),
		);
	});
});

describe("ConsoleLayout — rail shell", () => {
	it("captions the groups and carries API Docs inside Build", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 491 }, { id: 586 }, { id: 587 }],
		});

		renderRail();

		await screen.findByRole("link", { name: "Load Wallet" });
		expect(screen.getByText("Complete your KYC")).toBeVisible();
		expect(screen.getByText("Build")).toBeVisible();
		expect(screen.getByText("Account & History")).toBeVisible();
		expect(screen.getByRole("link", { name: /API Docs/ })).toHaveAttribute(
			"href",
			"/docs",
		);
		// Position, not mere presence: an API Docs link left dangling below every
		// group would still satisfy the href assertion above.
		const labels = railLabels();
		expect(labels.indexOf("API Docs")).toBe(labels.indexOf("Credentials") + 1);
	});

	it("hides the KYC section when neither onboarding item is entitled", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 491 }] });

		renderRail();

		// Wait for the entitlements to settle first, or the caption is absent
		// merely because nothing has resolved yet.
		await screen.findByRole("link", { name: "Load Wallet" });
		expect(screen.queryByText("Complete your KYC")).toBeNull();
		expect(screen.getByText("Build")).toBeVisible();
	});

	// The rail caption IS the page heading now — the old `<h1>Developer Console`
	// above the grid is gone. Sub-pages start at `<h2>`, so a rail that drops or
	// duplicates the h1 breaks the heading order on every console route.
	it("keeps exactly one h1 and the main landmark", () => {
		connectInteractions.mockResolvedValue({ interactions: [] });

		renderRail();

		const headings = screen.getAllByRole("heading", { level: 1 });
		expect(headings).toHaveLength(1);
		expect(headings[0]).toHaveTextContent("Developer Console");
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("home-page"),
		);
	});
});

describe("ConsoleLayout — Documents rail item", () => {
	it("appears directly after Home when KYC upload is entitled", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 586 }, { id: 587 }],
		});

		renderRail();

		const link = await screen.findByRole("link", { name: "Upload Documents" });
		expect(link).toHaveAttribute("href", "/console/documents");
		expect(railLabels().slice(0, 2)).toEqual(["Home", "Upload Documents"]);
	});

	it("stays hidden when the user can list documents but not upload them", async () => {
		// Every button on the page would fail upstream, which reads as a broken
		// console rather than an unavailable feature.
		connectInteractions.mockResolvedValue({ interactions: [{ id: 586 }] });

		renderRail();

		expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: "Upload Documents" }),
			).toBeNull(),
		);
	});

	it("stays hidden without either interaction", async () => {
		connectInteractions.mockResolvedValue({ interactions: [{ id: 491 }] });

		renderRail();

		expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: "Upload Documents" }),
			).toBeNull(),
		);
	});
});
