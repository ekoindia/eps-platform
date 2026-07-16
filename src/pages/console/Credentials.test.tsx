import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Credentials from "@/pages/console/Credentials";
import type { MeView } from "@/lib/auth/client";

function renderCredentials(me: MeView) {
	return render(
		<MemoryRouter initialEntries={["/console/credentials"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route path="credentials" element={<Credentials />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

const ACTIVE: MeView = {
	state: "active",
	mobile: "999",
	profile: null,
	zohoId: null,
};

describe("Credentials", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("shows the UAT keypair", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");
		renderCredentials(ACTIVE);
		expect(screen.getByText("dev-key-123")).toBeInTheDocument();
		expect(screen.getByText("access-key-456")).toBeInTheDocument();
	});

	it("shows the UAT keypair to a pre-onboarding developer too", () => {
		// DELIBERATE: the same keypair is published anonymously in llms.txt, so
		// gating it by lifecycle state would protect nothing.
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");
		renderCredentials({ ...ACTIVE, state: "lead" });
		expect(screen.getByText("dev-key-123")).toBeInTheDocument();
	});

	it("falls back to the placeholder when no UAT keypair is configured", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");
		renderCredentials(ACTIVE);
		expect(
			screen.getByText(/will appear here once issued/i),
		).toBeInTheDocument();
	});
});
