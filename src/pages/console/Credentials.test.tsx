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

	it("points an active developer at their account manager for production keys", () => {
		// Stub the UAT keys empty: the fallback UAT copy also says "issued", and
		// on a machine with real UAT keys configured (.env.local) the
		// credentials-present copy says "issued separately" too — pin the UAT
		// block to a known state so this assertion targets only the production
		// block regardless of ambient env.
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");
		renderCredentials(ACTIVE);
		expect(screen.getByText(/production api credentials/i)).toBeInTheDocument();
		expect(screen.getByText(/issued separately/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /contact your account manager/i }),
		).toHaveAttribute("href", "/grievance");
	});

	it("tells a lead to finish onboarding before requesting production keys", () => {
		renderCredentials({ ...ACTIVE, state: "lead" });
		expect(screen.getByText(/finish onboarding/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /continue onboarding/i }),
		).toHaveAttribute("href", "/signup");
	});

	it("tells an inactive account to contact support", () => {
		renderCredentials({ ...ACTIVE, state: "inactive" });
		expect(screen.getByText(/account is inactive/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /contact support/i }),
		).toHaveAttribute("href", "/grievance");
	});

	it("never renders a production key request button", () => {
		// There is no issuance API yet. A button that cannot issue a key is a lie.
		renderCredentials(ACTIVE);
		expect(screen.queryByRole("button", { name: /fetch|request/i })).toBeNull();
	});
});
