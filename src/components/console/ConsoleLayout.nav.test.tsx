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

describe("ConsoleLayout — Load Wallet rail item", () => {
	it("links to the entitled flow, directly after Home", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ id: 491, interaction_type_id: 0, behavior: 7 }],
		});

		renderRail();

		const link = await screen.findByRole("link", { name: "Load Wallet" });
		expect(link).toHaveAttribute("href", "/console/transaction/491");
		const labels = screen
			.getAllByRole("link")
			.map((a) => a.textContent?.trim());
		expect(labels.slice(0, 2)).toEqual(["Home", "Load Wallet"]);
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
