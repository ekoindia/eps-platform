import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/pages/console/Profile";
import { ApiError } from "@/lib/auth/client";
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

// The CRM card fetches through the client; everything else on the page is
// session-derived. ApiError stays real so the 404-vs-failure split is tested.
const { crmLead } = vi.hoisted(() => ({ crmLead: vi.fn() }));
vi.mock("@/lib/auth/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth/client")>();
	return { ...actual, authClient: { ...actual.authClient, crmLead } };
});

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
	crmLead.mockReset();
	// Default: a deployment with no CRM data, so suites that don't care about
	// CRM render without a pending request.
	crmLead.mockRejectedValue(new ApiError("NO_CRM_LEAD", "none", 404));
});

describe("Profile identity card", () => {
	it("shows the name, user type, code and formatted mobile", () => {
		renderProfile();
		expect(screen.getByText("Kumar Abhishek")).toBeInTheDocument();
		expect(screen.getByText("Enterprise Partner")).toBeInTheDocument();
		expect(screen.getByText("18120001")).toBeInTheDocument();
		expect(screen.getByText("+91 671 000 0002")).toBeInTheDocument();
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
		// Twice: with no profile name, the mobile is also the heading.
		expect(screen.getAllByText("+91 671 000 0002")).toHaveLength(2);
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"0",
		);
	});
});

describe("Profile business details", () => {
	const CRM_FIELDS = {
		Industry: "Fintech",
		Annual_Turnover: 25000000,
		Number_of_Employees: "51-200",
		Number_of_Clients: 120,
		GST_No: "07AAACA1234A1Z5",
		Count_of_Directors: 3,
		Authorized_Signatory_Full_name: "Asha Rao",
		Website: "https://acme.test",
		Mobile_App_Name: "Acme Pay",
	};

	/** The value cell next to a label. */
	const valueOf = (label: string) =>
		screen.getByText(label, { selector: "dt" }).nextElementSibling;

	it("no longer shows Eloka's personal fields", () => {
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				detailBlocks: {
					personal_detail: { gender: "Male", dob: "01-01-1990" },
				},
			},
		});
		expect(screen.queryByText("Personal Details")).toBeNull();
		expect(screen.queryByText("Gender")).toBeNull();
		expect(screen.queryByText("Male")).toBeNull();
	});

	it("shows profile fields: company type as a label, and email", () => {
		renderProfile({
			...ACTIVE,
			profile: { ...PROFILE, userDetail: { company_type: "4" } },
		});
		expect(valueOf("Company Type")).toHaveTextContent(
			"LLP (Limited Liability Partnership)",
		);
		expect(valueOf("Email")).toHaveTextContent("abhi@example.com");
	});

	it("renders every CRM field once the Lead loads", async () => {
		crmLead.mockResolvedValue({ id: "1", fields: CRM_FIELDS });
		renderProfile();
		await waitFor(() =>
			expect(valueOf("Industry")).toHaveTextContent("Fintech"),
		);
		expect(valueOf("Annual Turnover")).toHaveTextContent("2,50,00,000");
		expect(valueOf("Employees")).toHaveTextContent("51-200");
		expect(valueOf("Clients")).toHaveTextContent("120");
		expect(valueOf("GST Number")).toHaveTextContent("07AAACA1234A1Z5");
		expect(valueOf("Number of Directors")).toHaveTextContent("3");
		expect(valueOf("Authorized Signatory")).toHaveTextContent("Asha Rao");
		expect(valueOf("Mobile App")).toHaveTextContent("Acme Pay");
		expect(
			screen.getByRole("link", { name: "https://acme.test" }),
		).toHaveAttribute("href", "https://acme.test");
	});

	it("groups the fields into separate sections", async () => {
		crmLead.mockResolvedValue({ id: "1", fields: CRM_FIELDS });
		renderProfile();
		for (const title of [
			"Business Profile",
			"Legal & Compliance",
			"Contact & Online Presence",
		]) {
			expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
		}
	});

	// Partner-editable CRM data must never become a clickable javascript: URL.
	it("renders a non-http website as plain text, not a link", async () => {
		crmLead.mockResolvedValue({
			id: "1",
			fields: { Website: "javascript:alert(1)" },
		});
		renderProfile();
		await waitFor(() =>
			expect(valueOf("Website")).toHaveTextContent("javascript:alert(1)"),
		);
		expect(screen.queryByRole("link", { name: /javascript/ })).toBeNull();
	});

	it("shows a placeholder for CRM rows while loading, profile rows at once", () => {
		crmLead.mockReturnValue(new Promise(() => {}));
		renderProfile();
		expect(valueOf("Industry")).toHaveTextContent("…");
		expect(valueOf("Email")).toHaveTextContent("abhi@example.com");
	});

	it("shows dashes, not an error, when there is no CRM Lead", async () => {
		renderProfile();
		await waitFor(() => expect(valueOf("Industry")).toHaveTextContent("—"));
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("says so once when the CRM fails, keeping the profile rows", async () => {
		crmLead.mockRejectedValue(new ApiError("CRM_UNAVAILABLE", "down", 502));
		renderProfile();
		expect(await screen.findByRole("status")).toHaveTextContent(
			/couldn.t load your business details/i,
		);
		expect(valueOf("Email")).toHaveTextContent("abhi@example.com");
		expect(valueOf("Industry")).toHaveTextContent("—");
	});

	it("shows a dash rather than a non-displayable CRM value", async () => {
		crmLead.mockResolvedValue({
			id: "1",
			fields: { Industry: { name: "Fintech" }, Number_of_Clients: ["1"] },
		});
		renderProfile();
		await waitFor(() => expect(valueOf("Industry")).toHaveTextContent("—"));
		expect(valueOf("Clients")).toHaveTextContent("—");
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
