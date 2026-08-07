import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/pages/console/Profile";
import type { MeView, Profile as ProfileData } from "@/lib/auth/client";
import type { RoleTransactionList } from "@/lib/connect/interactions";

// The identity card reads the session for its initials fallback, exactly as the
// header menu does. Mocked at the module boundary, per repo convention.
let mockMe: MeView;
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({
		state: { status: "authed", role: "developer", me: mockMe },
		refresh: vi.fn(),
		logout: vi.fn(),
	}),
}));

let mockInteractions: RoleTransactionList | null = null;
vi.mock("@/lib/connect/use-interactions", () => ({
	useRoleTransactionList: () => mockInteractions,
}));

const PROFILE: ProfileData = {
	name: "Kumar Abhishek",
	email: "abhi@example.com",
	mobile: "6710000002",
	code: "18120001",
	userType: "23",
	ekoUserId: "20810124",
	roleList: [],
	orgId: 1,
	onboarding: 0,
	zohoId: "",
	onboardingSteps: [],
	accounts: [],
	evalueAccountId: null,
	detailBlocks: {},
	accountStateId: 16,
	userDetail: {},
};

const ACTIVE: MeView = {
	state: "active",
	mobile: "6710000002",
	profile: PROFILE,
	zohoId: null,
};

/** Interaction list granting Manage My Account (536) with two of its children. */
const WITH_MANAGE_ACCOUNT: RoleTransactionList = {
	"536": { label: "Manage My Account", group_interaction_ids: "898,7775" },
	"898": { label: "Sign Agreement" },
	"7775": { label: "Change Registered Mobile Number" },
};

function renderProfile(me: MeView = ACTIVE) {
	mockMe = me;
	return render(
		<MemoryRouter initialEntries={["/console/profile"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route path="profile" element={<Profile />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	mockInteractions = null;
});

describe("Profile identity card", () => {
	it("shows the name, user type, code and formatted mobile", () => {
		renderProfile();
		expect(screen.getByText("Kumar Abhishek")).toBeInTheDocument();
		expect(screen.getByText("Enterprise Partner")).toBeInTheDocument();
		expect(screen.getByText("18120001")).toBeInTheDocument();
		expect(screen.getByText("+91 67100 00002")).toBeInTheDocument();
	});

	it("reports 100% for a fully onboarded profile", () => {
		renderProfile();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"100",
		);
		expect(screen.getByText("100%")).toBeInTheDocument();
	});

	it("reports partial progress from the steps still pending", () => {
		// Four steps, two roles still pending → half done.
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				onboarding: 1,
				roleList: ["12600", "12800"],
				onboardingSteps: [
					{ role: 13000, label: "PAN Details" },
					{ role: 13100, label: "Business Details" },
					{ role: 12600, label: "Set Secret PIN" },
					{ role: 12800, label: "Sign Agreement" },
				],
			},
		});
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"50",
		);
	});

	it("falls back to the mobile when the session carries no profile", () => {
		// A lead has no Eko profile; the card must still render rather than crash.
		renderProfile({ ...ACTIVE, state: "lead", profile: null });
		expect(screen.getByText("+91 67100 00002")).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"0",
		);
	});
});

describe("Profile personal details", () => {
	it("renders the fields from the personal_detail block", () => {
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				detailBlocks: {
					personal_detail: {
						gender: "Male",
						dob: "01-01-1990",
						qualification: "Graduate",
						marital_status: "Single",
					},
				},
			},
		});
		expect(screen.getByText("Male")).toBeInTheDocument();
		expect(screen.getByText("01-01-1990")).toBeInTheDocument();
		expect(screen.getByText("Graduate")).toBeInTheDocument();
		expect(screen.getByText("Single")).toBeInTheDocument();
	});

	it("reads the plural spelling of the block too", () => {
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				detailBlocks: { personal_details: { gender: "Female" } },
			},
		});
		expect(screen.getByText("Female")).toBeInTheDocument();
	});

	it("shows a dash for every field when the block is absent", () => {
		renderProfile();
		expect(screen.getAllByText("—")).toHaveLength(4);
	});

	it("shows a dash rather than rendering a non-displayable value", () => {
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				detailBlocks: { personal_detail: { gender: { nested: "object" } } },
			},
		});
		expect(screen.getAllByText("—")).toHaveLength(4);
	});

	it("hides the edit link unless the user is entitled to interaction 401", () => {
		renderProfile();
		expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
	});

	it("links editing to the Connect flow when entitled", () => {
		mockInteractions = { "401": { label: "User Profile" } };
		renderProfile();
		expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
			"href",
			"/console/transaction/401",
		);
	});
});

describe("Profile manage-my-account rows", () => {
	it("lists 536's children and deep-links each one", () => {
		mockInteractions = WITH_MANAGE_ACCOUNT;
		renderProfile();
		expect(
			screen.getByRole("link", { name: "Sign Agreement" }),
		).toHaveAttribute("href", "/console/transaction/536/898");
		expect(
			screen.getByRole("link", { name: "Change Registered Mobile Number" }),
		).toHaveAttribute("href", "/console/transaction/536/7775");
	});

	it("renders nothing while the interaction list is unresolved", () => {
		// Fail closed: an unreadable list means not entitled, never "show anyway".
		renderProfile();
		expect(screen.queryByText("Manage My Account")).toBeNull();
	});

	it("renders nothing when the user is entitled to no children", () => {
		mockInteractions = {
			"536": { label: "Manage My Account", group_interaction_ids: "898" },
		};
		renderProfile();
		expect(screen.queryByText("Manage My Account")).toBeNull();
	});
});
