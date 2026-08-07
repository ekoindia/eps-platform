import LifecycleCard from "@/components/console/LifecycleCard";
import type { MeView } from "@/lib/auth/client";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

function show(me: MeView) {
	render(
		<MemoryRouter>
			<LifecycleCard me={me} />
		</MemoryRouter>,
	);
}

const ACTIVE: MeView = {
	state: "active",
	mobile: "9990000079",
	profile: null,
	zohoId: null,
};

describe("LifecycleCard", () => {
	it("renders the copy for a known lifecycle", () => {
		show(ACTIVE);
		expect(screen.getByText("Integration overview")).toBeInTheDocument();
		expect(screen.getByText(/9990000079/)).toBeInTheDocument();
	});

	// The console white-screened on `copy.title` when `state` fell outside
	// STATE_COPY.
	// A lifecycle added upstream must degrade, not take the page down.
	it("falls back to the unknown copy for a lifecycle it doesn't know", () => {
		show({ ...ACTIVE, state: "retired" as MeView["state"] });
		expect(screen.getByText("Welcome")).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
	});

	it("sends a KYC-pending account at the upload page, not back at signup", () => {
		show({ ...ACTIVE, state: "kyc-pending" });
		expect(screen.getByText("Finish your KYC")).toBeInTheDocument();
		expect(screen.getByText("KYC Pending")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Upload documents" }),
		).toHaveAttribute("href", "/console/documents");
	});

	it("names the account when neither profile nor mobile is present", () => {
		show({ ...ACTIVE, mobile: "" });
		expect(screen.getByText(/your account/)).toBeInTheDocument();
	});
});
