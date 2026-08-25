import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PayActivationFee from "@/pages/console/PayActivationFee";
import {
	calcActivationFee,
	FEE_PRODUCT_GROUPS,
	formatInr,
} from "@/lib/console/feeProducts";
import type { MeView } from "@/lib/auth/client";

// Mocked at the module boundary, per repo convention — never `fetch`.
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { activationFee: { intimate: vi.fn() } },
}));

// The uploader pulls in canvas, pdf.js and the dialog provider — none of which
// this page's logic depends on. Stubbed down to the one thing it contributes:
// a File handed back through `onFileChange`.
vi.mock("@/components/FileUpload", () => ({
	FileUpload: ({
		onFileChange,
	}: {
		onFileChange: (file: File | null) => void;
	}) => (
		<button
			type="button"
			onClick={() =>
				onFileChange(new File(["x"], "slip.pdf", { type: "application/pdf" }))
			}
		>
			attach-slip
		</button>
	),
}));

const { authClient } = await import("@/lib/auth/client");
const intimate = authClient.activationFee.intimate as ReturnType<typeof vi.fn>;

const ACTIVE: MeView = {
	state: "active",
	mobile: "999",
	profile: { name: "Acme Fintech" } as never,
	zohoId: null,
};

function renderPage(me: MeView = ACTIVE) {
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/console/pay-activation-fee"]}>
				<Routes>
					<Route path="/console" element={<Outlet context={me} />}>
						<Route path="pay-activation-fee" element={<PayActivationFee />} />
					</Route>
				</Routes>
			</MemoryRouter>
		</HelmetProvider>,
	);
}

/** Today in `YYYY-MM-DD`, the way the page defaults its date input. */
function today(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Types a value into a controlled field. */
function type(label: RegExp, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Fills every required field with something valid. */
function fillValid() {
	type(/transaction amount/i, "6000");
	type(/mode of payment/i, "NEFT");
	type(/utr/i, "N123456789");
	fireEvent.click(screen.getAllByRole("checkbox")[0]);
}

/** Clicks the submit button. */
function send() {
	fireEvent.click(screen.getByRole("button", { name: /send payment/i }));
}

/** The JSON the page put in the `payload` part of its request. */
function sentPayload(): Record<string, unknown> {
	const form = intimate.mock.calls[0][0] as FormData;
	return JSON.parse(String(form.get("payload"))) as Record<string, unknown>;
}

beforeEach(() => {
	intimate.mockResolvedValue({ message: "Thanks — sent to Team Eko." });
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("PayActivationFee — the standing information", () => {
	it("shows Eko's bank account in full", () => {
		renderPage();
		expect(screen.getByText("HDFC Bank")).toBeInTheDocument();
		expect(screen.getByText("Eko Bharat Ventures Pvt Ltd")).toBeInTheDocument();
		expect(screen.getByText("00032000039765")).toBeInTheDocument();
		expect(screen.getByText("HDFC0009141")).toBeInTheDocument();
	});

	it("points at the pricing calculator once there is a fee to explain", () => {
		renderPage();
		expect(screen.queryByRole("link", { name: /pricing calculator/i })).toBeNull();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		expect(
			screen.getByRole("link", { name: /pricing calculator/i }),
		).toHaveAttribute("href", "/pricing");
	});

	it("asks for a selection before it quotes anything", () => {
		renderPage();
		expect(screen.getByText(/work out/i)).toBeVisible();
		expect(screen.queryByText(/amount to transfer/i)).toBeNull();
	});

	it("opens at h2, leaving the page h1 to the console layout", () => {
		renderPage();
		expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
		expect(
			screen.getByRole("heading", { level: 2, name: /activation fee/i }),
		).toBeInTheDocument();
	});

	it("defaults the transaction date to today and refuses a later one", () => {
		renderPage();
		const date = screen.getByLabelText(/transaction date/i);
		expect(date).toHaveValue(today());
		expect(date).toHaveAttribute("max", today());
	});
});

describe("PayActivationFee — validation", () => {
	it("does not send an empty form, and names what is missing", async () => {
		renderPage();
		send();
		expect(intimate).not.toHaveBeenCalled();
		expect(await screen.findByText(/enter the amount/i)).toBeVisible();
		expect(screen.getByText(/choose how you transferred/i)).toBeVisible();
		expect(screen.getByText(/enter the utr/i)).toBeVisible();
		expect(screen.getByText(/select at least one product/i)).toBeVisible();
	});

	it("rejects a zero amount", async () => {
		renderPage();
		fillValid();
		type(/transaction amount/i, "0");
		send();
		expect(intimate).not.toHaveBeenCalled();
		expect(await screen.findByText(/valid amount/i)).toBeVisible();
	});

	it("accepts free text in place of a ticked product", async () => {
		renderPage();
		type(/transaction amount/i, "6000");
		type(/mode of payment/i, "IMPS");
		type(/utr/i, "N1");
		type(/anything else/i, "A bespoke API");
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		expect(sentPayload().otherProducts).toBe("A bespoke API");
	});
});

describe("PayActivationFee — submission", () => {
	it("posts the transfer details, and only the transfer details", async () => {
		renderPage();
		fillValid();
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalledTimes(1));

		const payload = sentPayload();
		expect(payload.amount).toBe("6000");
		expect(payload.date).toBe(today());
		expect(payload.mode).toBe("NEFT");
		expect(payload.utr).toBe("N123456789");
		expect(Array.isArray(payload.products)).toBe(true);
		expect((payload.products as string[]).length).toBe(1);
		// Identity is the backend's to add from the session profile; the browser
		// must not be the one asserting who is paying.
		expect(payload).not.toHaveProperty("name");
		expect(payload).not.toHaveProperty("pan");
		expect(payload).not.toHaveProperty("gst");
	});

	it("sends product names, not the ids the form holds", async () => {
		renderPage();
		fillValid();
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		const [product] = sentPayload().products as string[];
		// An id is kebab-case and lowercase; a name is neither.
		expect(product).toMatch(/[A-Z ]/);
	});

	it("attaches the slip when one is picked", async () => {
		renderPage();
		fillValid();
		fireEvent.click(screen.getByRole("button", { name: "attach-slip" }));
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		const form = intimate.mock.calls[0][0] as FormData;
		expect(form.get("attachment")).toBeInstanceOf(File);
	});

	it("omits the attachment part when no slip is picked", async () => {
		renderPage();
		fillValid();
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		const form = intimate.mock.calls[0][0] as FormData;
		expect(form.get("attachment")).toBeNull();
	});

	it("replaces the form with a confirmation once sent", async () => {
		renderPage();
		fillValid();
		send();
		expect(await screen.findByText(/payment details sent/i)).toBeVisible();
		expect(screen.queryByRole("button", { name: /send payment/i })).toBeNull();
	});

	it("does not send twice on a double click", async () => {
		let release: (value: { message: string }) => void = () => {};
		intimate.mockReturnValue(
			new Promise<{ message: string }>((resolve) => {
				release = resolve;
			}),
		);
		renderPage();
		fillValid();
		const button = screen.getByRole("button", { name: /send payment/i });
		fireEvent.click(button);
		await waitFor(() => expect(button).toBeDisabled());
		fireEvent.click(button);
		expect(intimate).toHaveBeenCalledTimes(1);
		release({ message: "ok" });
	});

	it("surfaces a failure inline and lets the partner retry", async () => {
		intimate.mockRejectedValueOnce(new Error("Couldn't send your details."));
		renderPage();
		fillValid();
		send();
		// ErrorNotice only echoes a message it judges safe to show; a bare Error
		// falls back, so the contract under test is that the alert appears at all.
		expect(await screen.findByRole("alert")).toBeVisible();
		// Still a form, not a confirmation: the money story is unfinished.
		expect(screen.queryByText(/payment details sent/i)).toBeNull();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /send payment/i }),
			).toBeEnabled(),
		);
	});
});

describe("PayActivationFee — the calculated fee", () => {
	/** The fee for whatever the first checkbox is, at today's rates. */
	const firstOptionFee = () =>
		calcActivationFee([FEE_PRODUCT_GROUPS[0].options[0].id]);

	it("prefills the amount to transfer from the selection", () => {
		renderPage();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		expect(screen.getByLabelText(/transaction amount/i)).toHaveValue(
			firstOptionFee().total,
		);
	});

	it("shows the discount and GST that make up the total", () => {
		renderPage();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		const fee = firstOptionFee();
		expect(screen.getByText(/amount to transfer/i)).toBeVisible();
		expect(screen.getByText(formatInr(fee.total))).toBeVisible();
		expect(screen.getByText(formatInr(fee.gst))).toBeVisible();
		expect(screen.getByText(new RegExp(`${fee.discountPercent}% off`))).toBeVisible();
	});

	it("re-quotes when the selection changes", () => {
		renderPage();
		const boxes = screen.getAllByRole("checkbox");
		fireEvent.click(boxes[0]);
		const one = Number(
			(screen.getByLabelText(/transaction amount/i) as HTMLInputElement).value,
		);
		fireEvent.click(boxes[1]);
		const two = Number(
			(screen.getByLabelText(/transaction amount/i) as HTMLInputElement).value,
		);
		expect(two).toBeGreaterThan(one);
	});

	it("clears the amount again when the last product is unticked", () => {
		renderPage();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		expect(screen.getByLabelText(/transaction amount/i)).toHaveValue(null);
	});

	it("stops overwriting an amount the partner typed themselves", () => {
		renderPage();
		const boxes = screen.getAllByRole("checkbox");
		fireEvent.click(boxes[0]);
		type(/transaction amount/i, "12345");
		fireEvent.click(boxes[1]);
		expect(screen.getByLabelText(/transaction amount/i)).toHaveValue(12345);
	});

	it("sends the amount the partner confirms, not the suggestion", async () => {
		renderPage();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		type(/transaction amount/i, "9999");
		type(/mode of payment/i, "RTGS");
		type(/utr/i, "N7");
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		expect(sentPayload().amount).toBe("9999");
	});

	it("warns that free text is not priced, so the total is short", () => {
		renderPage();
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		expect(screen.queryByText(/add its fee to the amount/i)).toBeNull();
		type(/anything else/i, "A bespoke API");
		expect(screen.getByText(/add its fee to the amount/i)).toBeVisible();
	});
});

describe("PayActivationFee — searching the product list", () => {
	/** Labels of every checkbox currently rendered. */
	const shownLabels = () =>
		screen
			.getAllByRole("checkbox")
			.map((box) => box.closest("label")?.textContent?.trim());

	it("leads with the Banking & Payments families", () => {
		renderPage();
		expect(shownLabels().slice(0, 3)).toEqual([
			"Money Transfer (DMT)",
			"AePS",
			"Bill Payments (BBPS)",
		]);
	});

	it("narrows the list as the partner types", () => {
		renderPage();
		const before = shownLabels().length;
		type(/search products/i, "aeps");
		expect(shownLabels()).toEqual(["AePS"]);
		expect(before).toBeGreaterThan(1);
	});

	it("ignores case", () => {
		renderPage();
		type(/search products/i, "AEPS");
		expect(shownLabels()).toEqual(["AePS"]);
	});

	it("restores the full list when the search is cleared", () => {
		renderPage();
		const before = shownLabels().length;
		type(/search products/i, "aeps");
		type(/search products/i, "");
		expect(shownLabels()).toHaveLength(before);
	});

	it("says so when nothing matches, instead of showing an empty box", () => {
		renderPage();
		type(/search products/i, "zzzznotanapi");
		expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
		expect(screen.getByText(/no api matches/i)).toBeVisible();
	});

	it("keeps a selection made before the search was narrowed", () => {
		renderPage();
		type(/search products/i, "aeps");
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		const amount = (screen.getByLabelText(/transaction amount/i) as HTMLInputElement)
			.value;
		type(/search products/i, "pan");
		// The tick is filtered out of view, but the fee it drove is untouched.
		expect(screen.getByLabelText(/transaction amount/i)).toHaveValue(
			Number(amount),
		);
	});

	it("submits a product selected through the search", async () => {
		renderPage();
		type(/search products/i, "aeps");
		fireEvent.click(screen.getAllByRole("checkbox")[0]);
		type(/mode of payment/i, "IMPS");
		type(/utr/i, "N42");
		send();
		await waitFor(() => expect(intimate).toHaveBeenCalled());
		expect(sentPayload().products).toEqual(["AePS"]);
	});
});
