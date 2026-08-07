import ProfileCard from "@/components/console/ProfileCard";
import type { MeView } from "@/lib/auth/client";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

const ME: MeView = {
	state: "active",
	mobile: "9990000079",
	profile: {
		name: "Asha Kumari",
		email: "asha@example.com",
		mobile: "9998887777",
		// Numeric upstream, as the API sends it.
		code: 18120001,
	} as never,
	zohoId: null,
};

function show(me: MeView) {
	render(
		<MemoryRouter>
			<ProfileCard me={me} />
		</MemoryRouter>,
	);
}

describe("ProfileCard", () => {
	it("shows the name, state, formatted mobile and email", () => {
		show(ME);
		expect(screen.getByText("Asha Kumari")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
		expect(screen.getByText("+91 999 888 7777")).toBeInTheDocument();
		expect(screen.getByText("asha@example.com")).toBeInTheDocument();
		expect(screen.getByText("AK")).toBeInTheDocument();
	});

	it("shows the EkoCode with a copy button", () => {
		show(ME);
		expect(screen.getByText(/EkoCode 18120001/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Copy EkoCode" }),
		).toBeInTheDocument();
	});

	it("drops the EkoCode row when the profile has no code", () => {
		show({ ...ME, profile: { ...ME.profile, code: "" } as never });
		expect(screen.queryByText(/EkoCode/)).not.toBeInTheDocument();
	});

	it("links through to the full profile page", () => {
		show(ME);
		expect(screen.getByRole("link", { name: "View Profile" })).toHaveAttribute(
			"href",
			"/console/profile",
		);
	});

	// The profile lookup comes back empty for an account upstream doesn't know
	// yet. The card still has to render, off the one thing the session always
	// carries.
	it("falls back to the session mobile when there is no profile", () => {
		show({ ...ME, profile: null });
		expect(screen.getByText("9990000079")).toBeInTheDocument();
		expect(screen.getByText("+91 999 000 0079")).toBeInTheDocument();
		// Initials off a phone number would read "9". `#79` reads as an account.
		expect(screen.getByText("#79")).toBeInTheDocument();
	});

	it("drops the email row rather than showing an empty one", () => {
		show({ ...ME, profile: { ...ME.profile, email: "  " } as never });
		expect(screen.queryByText(/@/)).not.toBeInTheDocument();
	});

	// Upstream defaults absent fields to "", so a blank profile mobile must not
	// beat the number the session signed in with.
	it("ignores a blank profile mobile", () => {
		show({ ...ME, profile: { ...ME.profile, mobile: " " } as never });
		expect(screen.getByText("+91 999 000 0079")).toBeInTheDocument();
	});

	it("shows the pending state for an account still in KYC", () => {
		show({ ...ME, state: "kyc-pending" });
		expect(screen.getByText("KYC Pending")).toBeInTheDocument();
	});
});
