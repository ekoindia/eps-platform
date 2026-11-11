import ProfileCard from "@/components/console/ProfileCard";
import type { MeView } from "@/lib/auth/client";
import { ApiError } from "@/lib/auth/client";
import type { CrmLeadState } from "@/lib/crm/lead-store";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The card reads the CRM Lead for its meter and questions; the store itself has
// its own tests, so it's mocked at the hook, as the Documents page tests do.
const { crm, update } = vi.hoisted(() => ({
	crm: { state: { status: "loading" } as CrmLeadState },
	update: vi.fn(),
}));
vi.mock("@/lib/crm/use-crm-lead", () => ({
	useCrmLead: () => ({ state: crm.state, fields: null, update }),
}));

beforeEach(() => {
	crm.state = { status: "loading" };
	update.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

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

	it.each(["kyc-pending", "kyc-rejected"] as const)(
		"links the %s tag to the documents page",
		(state) => {
			show({ ...ME, state });
			expect(
				screen.getByRole("link", { name: /^KYC/ }),
			).toHaveAttribute("href", "/console/documents");
		},
	);

	it("leaves a non-KYC tag unlinked", () => {
		show(ME);
		expect(screen.queryByRole("link", { name: "Active" })).toBeNull();
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

	// 47 read as `active` before the state existed, so the one account that most
	// needs to act was told it had nothing to do. Red, not grey, for that reason.
	it("shows a rejected KYC in red, not as Active", () => {
		show({ ...ME, state: "kyc-rejected" });
		const badge = screen.getByText("KYC Rejected");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveClass("bg-destructive");
		expect(screen.queryByText("Active")).toBeNull();
	});
});

describe("ProfileCard questions", () => {
	/** A sole proprietor: no director question, company type filled. */
	const SOLE: MeView = {
		...ME,
		profile: { ...ME.profile, userDetail: { company_type: "3" } } as never,
	};

	const PICKLISTS = {
		Industry: Array.from({ length: 14 }, (_, i) => `Industry ${i + 1}`),
		Annual_Turnover: ["Pre-revenue", "Under ₹25 lakh"],
		Number_of_Employees: ["1", "2 – 10"],
		Number_of_Clients: ["1 – 50", "Not sure"],
	};

	const ALL_FILLED = {
		Industry: "Industry 1",
		Annual_Turnover: "Pre-revenue",
		Number_of_Employees: "1",
		Number_of_Clients: "Not sure",
		GST_No: "07AAACA1234A1Z5",
		Authorized_Signatory_Full_name: "Asha Kumari",
		Website: "https://acme.test",
		Mobile_App_Name: "Acme Pay",
	};

	/** Shows the card over a loaded Lead with these fields left empty. */
	function withEmpty(...empty: string[]) {
		const fields: Record<string, unknown> = { ...ALL_FILLED };
		for (const name of empty) fields[name] = null;
		crm.state = { status: "ok", fields, picklists: PICKLISTS };
		// First of each tier, deterministically.
		vi.spyOn(Math, "random").mockReturnValue(0);
		show(SOLE);
	}

	it("shows no meter or question until the Lead loads", () => {
		show(SOLE);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByText("Skip this one")).toBeNull();
	});

	it("asks nothing when there is no Lead to write to", () => {
		crm.state = { status: "none" };
		show(SOLE);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByText("Skip this one")).toBeNull();
	});

	it("meters the profile by filled fields", () => {
		withEmpty("Number_of_Clients", "Mobile_App_Name");
		// 10 fields for a sole proprietor, 8 filled.
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"80",
		);
	});

	it("asks higher-priority questions first", () => {
		withEmpty("Number_of_Clients", "Annual_Turnover");
		expect(screen.getByText("What is your annual turnover?")).toBeInTheDocument();
		expect(screen.getByText("1 of 2")).toBeInTheDocument();
	});

	it("saves a chip answer to the CRM and moves on", async () => {
		withEmpty("Annual_Turnover");
		fireEvent.click(screen.getByRole("button", { name: "Under ₹25 lakh" }));
		await waitFor(() =>
			expect(update).toHaveBeenCalledWith({ Annual_Turnover: "Under ₹25 lakh" }),
		);
		expect(await screen.findByText("Annual Turnover saved")).toBeInTheDocument();
	});

	it("offers a long picklist as a select", () => {
		withEmpty("Industry");
		expect(
			screen.getByRole("combobox", { name: "Which industry is your business in?" }),
		).toBeInTheDocument();
	});

	it("offers Save only once a typed answer is valid", async () => {
		withEmpty("GST_No");
		const input = screen.getByLabelText("What is your GST number?");
		expect(screen.queryByRole("button", { name: "Save" })).toBeNull();

		fireEvent.change(input, { target: { value: "07AAACA" } });
		expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
		// Enter still submits, and says what's wrong.
		fireEvent.submit(input.closest("form")!);
		expect(
			await screen.findByText("Enter a valid 15-character GSTIN."),
		).toBeInTheDocument();
		expect(update).not.toHaveBeenCalled();

		fireEvent.change(input, { target: { value: "07aaaca1234a1z5" } });
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(update).toHaveBeenCalledWith({ GST_No: "07AAACA1234A1Z5" }),
		);
	});

	it("says why a save failed, and keeps the question", async () => {
		update.mockRejectedValue(new ApiError("CRM_DOWN", "down", 502));
		withEmpty("Annual_Turnover");
		fireEvent.click(screen.getByRole("button", { name: "Pre-revenue" }));
		expect(
			await screen.findByText(
				"Couldn't save to our records. Please try again shortly.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("What is your annual turnover?")).toBeInTheDocument();
	});

	it("sends a skipped question to the back of the queue", () => {
		withEmpty("Annual_Turnover", "Number_of_Clients");
		fireEvent.click(screen.getByRole("button", { name: "Skip this one" }));
		expect(
			screen.getByText("Roughly how many clients do you serve?"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Skip this one" }));
		expect(screen.getByText("What is your annual turnover?")).toBeInTheDocument();
	});

	it("can't skip the last question", () => {
		withEmpty("Annual_Turnover");
		expect(screen.getByRole("button", { name: "Skip this one" })).toBeDisabled();
	});

	it("hides mobile and email while a question is showing", () => {
		withEmpty("Annual_Turnover");
		expect(screen.queryByText("+91 999 888 7777")).toBeNull();
		expect(screen.queryByText("asha@example.com")).toBeNull();
	});

	it("says so once everything is filled in", () => {
		// Nothing to ask, so the contact details are back.
		withEmpty();
		expect(screen.getByText("+91 999 888 7777")).toBeInTheDocument();
		expect(screen.getByText(/Profile complete/)).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"100",
		);
	});
});
