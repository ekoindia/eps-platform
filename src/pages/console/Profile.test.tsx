import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/pages/console/Profile";
import { ApiError } from "@/lib/auth/client";
import { resetCrmLeadCache } from "@/lib/crm/lead-store";
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
const { crmLead, updateCrmLead } = vi.hoisted(() => ({
	crmLead: vi.fn(),
	updateCrmLead: vi.fn(),
}));
vi.mock("@/lib/auth/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth/client")>();
	return {
		...actual,
		authClient: { ...actual.authClient, crmLead, updateCrmLead },
	};
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
	userDetail: { crm_lead_id: "5545974000000317001" },
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
	updateCrmLead.mockReset();
	// The store is module-level and caches to localStorage: start every test
	// from nothing, as a fresh sign-in would.
	localStorage.clear();
	resetCrmLeadCache();
	// The backend answers a save with exactly the fields it wrote.
	updateCrmLead.mockImplementation(
		async (updated: Record<string, unknown>) => ({
			id: "1",
			updated,
		}),
	);
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

	/** A Private Limited profile, so company type and email both count. */
	const COMPANY = {
		...ACTIVE,
		profile: {
			...PROFILE,
			userDetail: { ...PROFILE.userDetail, company_type: "1" },
		},
	};

	it("meters the profile by filled fields, not onboarding steps", async () => {
		crmLead.mockResolvedValue({
			id: "1",
			fields: {
				Industry: "Logistics",
				Annual_Turnover: "Pre-revenue",
				Number_of_Employees: "1",
				Number_of_Clients: "Not sure",
				GST_No: "07AAACA1234A1Z5",
				Count_of_Directors: 3,
				Authorized_Signatory_Full_name: "Asha Rao",
				Website: "https://acme.test",
				Mobile_App_Name: "Acme Pay",
			},
		});
		renderProfile(COMPANY);
		const meter = await screen.findByRole("progressbar");
		expect(meter).toHaveAttribute("aria-valuenow", "100");
		expect(screen.getByText("100%")).toBeInTheDocument();
	});

	// A fully onboarded partner used to read 100% here with every business
	// field still blank.
	it("reports empty fields as missing, however far onboarding got", async () => {
		crmLead.mockResolvedValue({ id: "1", fields: { Industry: "Logistics" } });
		renderProfile(COMPANY);
		// Company type, email and industry: 3 of 11.
		expect(await screen.findByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"27",
		);
	});

	it("shows no meter without CRM data to count", async () => {
		renderProfile();
		await waitFor(() => expect(crmLead).toHaveBeenCalled());
		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("falls back to the mobile when the session carries no profile", () => {
		// A lead has no Eko profile; the card must still render rather than crash.
		renderProfile({ ...ACTIVE, state: "lead", profile: null });
		// Twice: with no profile name, the mobile is also the heading.
		expect(screen.getAllByText("+91 671 000 0002")).toHaveLength(2);
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

	it("names, settles or drops the director count by business type", () => {
		const withType = (company_type: string, name = PROFILE.name) => ({
			...ACTIVE,
			profile: { ...PROFILE, name, userDetail: { company_type } },
		});

		const { unmount } = renderProfile(withType("2"));
		expect(valueOf("Number of Partners")).toBeTruthy();
		unmount();

		renderProfile(withType("1", "Acme (OPC) Private Limited"));
		expect(valueOf("Number of Directors")).toHaveTextContent(
			"1 (One Person Company)",
		);
	});

	it.each(["3", "7"])("has no director count for company type %s", (code) => {
		renderProfile({
			...ACTIVE,
			profile: { ...PROFILE, userDetail: { company_type: code } },
		});
		expect(screen.queryByText(/Number of/, { selector: "dt" })).toBeNull();
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

describe("Profile business details — editing", () => {
	const PICKLISTS = {
		Industry: ["Financial Services", "IT/Software", "Others"],
		Annual_Turnover: ["Pre-revenue", "\u20b9 5 \u2013 25 crore"],
		Number_of_Employees: ["1", "51 \u2013 200"],
		Number_of_Clients: ["1 \u2013 50", "Not sure"],
	};
	const FIELDS = {
		Industry: "Financial Services",
		Annual_Turnover: "Pre-revenue",
		Number_of_Employees: "1",
		Number_of_Clients: "Not sure",
		GST_No: "07AAACA1234A1Z5",
		Count_of_Directors: 2,
		Authorized_Signatory_Full_name: "Asha Rao",
		Website: "https://acme.test",
		Mobile_App_Name: "Acme Pay",
	};

	/** The card whose heading is `title`. */
	const card = (title: string) =>
		screen.getByRole("heading", { name: title }).closest("section")!;

	async function openEditor(
		title: string,
		fields: Record<string, unknown> = FIELDS,
	) {
		crmLead.mockResolvedValue({ id: "1", fields, picklists: PICKLISTS });
		renderProfile();
		fireEvent.click(
			await screen.findByRole("button", { name: `Edit ${title}` }),
		);
		return within(card(title));
	}

	it("offers no Edit while loading, or when there is no CRM Lead", async () => {
		crmLead.mockReturnValue(new Promise(() => {}));
		const { unmount } = renderProfile();
		expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
		unmount();
		resetCrmLeadCache();

		crmLead.mockRejectedValue(new ApiError("NO_CRM_LEAD", "none", 404));
		renderProfile();
		await waitFor(() => expect(crmLead).toHaveBeenCalled());
		expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
	});

	it("renders picklists as selects of the backend's options", async () => {
		const form = await openEditor("Business Profile");
		const industry = form.getByLabelText("Industry") as HTMLSelectElement;
		expect(industry.value).toBe("Financial Services");
		// Populated, so no blank choice — it may be replaced, not removed.
		expect([...industry.options].map((o) => o.value)).toEqual([
			"Financial Services",
			"IT/Software",
			"Others",
		]);
		// Profile-sourced rows stay read-only.
		expect(form.queryByLabelText("Company Type")).toBeNull();
	});

	it("saves only the changed field and shows the new value", async () => {
		const form = await openEditor("Business Profile");
		fireEvent.change(form.getByLabelText("Industry"), {
			target: { value: "IT/Software" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({ Industry: "IT/Software" }),
		);
		expect(
			await within(card("Business Profile")).findByText("IT/Software"),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
	});

	it("makes no request when nothing changed", async () => {
		const form = await openEditor("Legal & Compliance");
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "Save" })).toBeNull(),
		);
		expect(updateCrmLead).not.toHaveBeenCalled();
	});

	// A Lead may hold an Industry sales set before the list was trimmed. It must
	// display, and saving another field must not rewrite or blank it.
	it("keeps a legacy picklist value selectable and never resends it", async () => {
		const form = await openEditor("Business Profile", {
			...FIELDS,
			Industry: "Large Enterprise",
		});
		const industry = form.getByLabelText("Industry") as HTMLSelectElement;
		expect(industry.value).toBe("Large Enterprise");
		fireEvent.change(form.getByLabelText("Employees"), {
			target: { value: "51 \u2013 200" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({
				Number_of_Employees: "51 \u2013 200",
			}),
		);
	});

	it("sends a director count as a number", async () => {
		const form = await openEditor("Legal & Compliance");
		fireEvent.change(form.getByLabelText("Number of Directors"), {
			target: { value: "5" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({ Count_of_Directors: 5 }),
		);
	});

	it("refuses to empty a field that was already filled in", async () => {
		const form = await openEditor("Legal & Compliance");
		fireEvent.change(form.getByLabelText("Authorized Signatory"), {
			target: { value: "   " },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		expect(
			await form.findByText("This can't be left empty once filled in."),
		).toBeInTheDocument();
		expect(updateCrmLead).not.toHaveBeenCalled();
	});

	it("lets an empty field stay empty, and offers a blank choice only while unset", async () => {
		const form = await openEditor("Business Profile", {
			...FIELDS,
			Industry: null,
		});
		const industry = form.getByLabelText("Industry") as HTMLSelectElement;
		expect(industry.value).toBe("");
		expect(industry.options[0].value).toBe("");
		expect(
			(form.getByLabelText("Employees") as HTMLSelectElement).options[0].value,
		).toBe("1");
		// Saving with the unset field still unset is not a change.
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "Save" })).toBeNull(),
		);
		expect(updateCrmLead).not.toHaveBeenCalled();
	});

	it("still overwrites a filled field with a valid value", async () => {
		const form = await openEditor("Legal & Compliance");
		fireEvent.change(form.getByLabelText("Authorized Signatory"), {
			target: { value: "Ravi Iyer" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({
				Authorized_Signatory_Full_name: "Ravi Iyer",
			}),
		);
	});

	// The cache is patched with what was written; no second Zoho read.
	it("shows the saved value at once, without refetching the Lead", async () => {
		const form = await openEditor("Contact & Online Presence");
		fireEvent.change(form.getByLabelText("Mobile App"), {
			target: { value: "Acme Wallet" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		expect(
			await within(card("Contact & Online Presence")).findByText("Acme Wallet"),
		).toBeInTheDocument();
		expect(crmLead).toHaveBeenCalledTimes(1);
	});

	it("upper-cases a GSTIN and blocks an invalid one before any request", async () => {
		const form = await openEditor("Legal & Compliance");
		fireEvent.change(form.getByLabelText("GST Number"), {
			target: { value: "not-a-gstin" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		expect(
			await form.findByText("Enter a valid 15-character GSTIN."),
		).toBeInTheDocument();
		expect(updateCrmLead).not.toHaveBeenCalled();

		fireEvent.change(form.getByLabelText("GST Number"), {
			target: { value: "29aabcu9603r1zm" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({ GST_No: "29AABCU9603R1ZM" }),
		);
	});

	it("blocks a non-http website", async () => {
		const form = await openEditor("Contact & Online Presence");
		fireEvent.change(form.getByLabelText("Website"), {
			target: { value: "javascript:alert(1)" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		expect(
			await form.findByText("Enter a full address starting with https://"),
		).toBeInTheDocument();
		expect(updateCrmLead).not.toHaveBeenCalled();
	});

	const optionsOf = (select: HTMLElement) =>
		Array.from((select as HTMLSelectElement).options, (o) => o.value);

	it("offers 1–15 directors when the business type is unknown", async () => {
		const form = await openEditor("Legal & Compliance", {
			...FIELDS,
			Count_of_Directors: null,
		});
		expect(optionsOf(form.getByLabelText("Number of Directors"))).toEqual([
			"",
			...Array.from({ length: 15 }, (_, i) => String(i + 1)),
		]);
	});

	it("offers a public company 3–15 directors, saved as a number", async () => {
		crmLead.mockResolvedValue({
			id: "1",
			fields: FIELDS,
			picklists: PICKLISTS,
		});
		renderProfile({
			...ACTIVE,
			profile: {
				...PROFILE,
				userDetail: { ...PROFILE.userDetail, company_type: "5" },
			},
		});
		fireEvent.click(
			await screen.findByRole("button", { name: "Edit Legal & Compliance" }),
		);
		const form = within(card("Legal & Compliance"));
		const select = form.getByLabelText("Number of Directors");
		// The stored 2 is outside the range: kept as-is, so it is never rewritten.
		expect(optionsOf(select)).toEqual([
			"2",
			...Array.from({ length: 13 }, (_, i) => String(i + 3)),
		]);
		fireEvent.change(select, { target: { value: "7" } });
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(updateCrmLead).toHaveBeenCalledWith({ Count_of_Directors: 7 }),
		);
	});

	it("shows the server's message on a 400, and a generic one otherwise", async () => {
		updateCrmLead.mockRejectedValueOnce(
			new ApiError(
				"INVALID_FIELD_VALUE",
				'"Industry" must be one of the listed options.',
				400,
			),
		);
		const form = await openEditor("Business Profile");
		fireEvent.change(form.getByLabelText("Industry"), {
			target: { value: "Others" },
		});
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		expect(await form.findByRole("alert")).toHaveTextContent(
			"must be one of the listed options",
		);

		updateCrmLead.mockRejectedValueOnce(
			new ApiError("CRM_UNAVAILABLE", "Zoho internals", 502),
		);
		fireEvent.click(form.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(form.getByRole("alert")).toHaveTextContent(/couldn.t save/i),
		);
		expect(form.getByRole("alert")).not.toHaveTextContent("Zoho internals");
		// The draft survives a failed save.
		expect((form.getByLabelText("Industry") as HTMLSelectElement).value).toBe(
			"Others",
		);
	});

	it("Cancel discards the draft", async () => {
		const form = await openEditor("Business Profile");
		fireEvent.change(form.getByLabelText("Industry"), {
			target: { value: "Others" },
		});
		fireEvent.click(form.getByRole("button", { name: "Cancel" }));
		expect(updateCrmLead).not.toHaveBeenCalled();
		expect(
			within(card("Business Profile")).getByText("Financial Services"),
		).toBeInTheDocument();
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
