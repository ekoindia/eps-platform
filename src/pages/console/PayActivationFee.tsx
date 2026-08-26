import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { ErrorNotice } from "@/components/console/ErrorNotice";
import { FadeIn } from "@/components/FadeIn";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { profileGstNumber } from "@/lib/auth/identity";
import {
	calcActivationFee,
	filterFeeProducts,
	formatInr,
	labelsForFeeProducts,
} from "@/lib/console/feeProducts";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/pages/ai/CommandBlock";
import { CircleCheck, Landmark, Search } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { toast } from "sonner";

/**
 * Eko's collection account. Hardcoded on purpose: it is the one fact on this
 * page that must never vary by environment, feature flag or API response — a
 * partner transferring money needs to read the same account number in UAT, in
 * production and in a screenshot from six months ago.
 */
const BANK_DETAILS: { label: string; value: string }[] = [
	{ label: "Bank", value: "HDFC Bank" },
	{ label: "Account Name", value: "Eko Bharat Ventures Pvt Ltd" },
	{ label: "Account Number", value: "00032000039765" },
	{ label: "IFSC Code", value: "HDFC0009141" },
];

/**
 * The rails a partner can transfer over, commonest first. Mirrors the backend's
 * allowlist, which is what actually enforces it.
 */
const MODES = ["IMPS", "NEFT", "RTGS", "Intra-Bank Transfer"] as const;

/** What the attachment input accepts. Mirrors the backend's allowlist. */
const SLIP_ACCEPT = "image/jpeg,image/png,application/pdf";
const SLIP_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The partner name, but only when it reads as one.
 *
 * Upstream defaults a missing name to the mobile number, so a profile routinely
 * carries "7200000002" as its `name`. Prefilling a depositor field with that
 * invites the partner to leave a phone number where finance expects an account
 * holder, so a name with no letters in it is treated as no name at all.
 * @param name - `profile.name`, or undefined.
 * @returns The trimmed name, or "" when it carries no letters.
 */
function nameOrBlank(name: string | undefined): string {
	const trimmed = name?.trim() ?? "";
	return /\p{L}/u.test(trimmed) ? trimmed : "";
}

/** Today in `YYYY-MM-DD`, for the date input's default and its `max`. */
function today(): string {
	const now = new Date();
	// Local parts, not `toISOString`: a partner in IST filing after 05:30 would
	// otherwise be handed yesterday's date as their default.
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

/** The form's own state. Amounts and dates stay strings until submit. */
interface FormState {
	amount: string;
	date: string;
	mode: string;
	utr: string;
	/** Whose bank account the money came from, as printed on it. */
	depositorName: string;
	products: string[];
	otherProducts: string;
	/** Only collected when the profile carries no GST number of its own. */
	gst: string;
}

/** Fields whose error is shown once the partner has left them. */
type TouchableField =
	| "amount"
	| "date"
	| "mode"
	| "utr"
	| "depositorName"
	| "products";

/**
 * The problem with one field, or null when it is fine.
 *
 * Mirrors the backend's rules deliberately rather than trusting them to be the
 * only gate: the server still re-checks everything, but a partner should not
 * have to round-trip to learn they left the UTR blank.
 * @param field - Which field to check.
 * @param form - The current form state.
 * @returns The message to show, or null.
 */
function validateField(field: TouchableField, form: FormState): string | null {
	switch (field) {
		case "amount": {
			const amount = Number(form.amount.trim());
			if (!form.amount.trim()) return "Enter the amount you transferred";
			if (!Number.isFinite(amount) || amount <= 0)
				return "Enter a valid amount in rupees";
			if (Math.round(amount * 100) !== amount * 100)
				return "At most two decimal places";
			return null;
		}
		case "date": {
			if (!form.date) return "Enter the date of the transfer";
			return form.date > today() ? "The date can't be in the future" : null;
		}
		case "mode":
			return MODES.includes(form.mode as (typeof MODES)[number])
				? null
				: "Choose how you transferred the money";
		case "utr":
			return form.utr.trim() ? null : "Enter the UTR / reference number";
		case "depositorName":
			return form.depositorName.trim()
				? null
				: "Enter the name on the bank account";
		case "products":
			return form.products.length > 0 || form.otherProducts.trim()
				? null
				: "Select at least one product";
	}
}

const FIELDS: TouchableField[] = [
	"amount",
	"date",
	"mode",
	"utr",
	"depositorName",
	"products",
];

/** One `label / value / copy` row of the bank-account block. */
function BankRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
				{label}
			</span>
			<code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
				{value}
			</code>
			<CopyButton text={value} label={`Copy ${label}`} />
		</div>
	);
}

/** A captioned section of the page. */
function Section({
	title,
	step,
	description,
	children,
}: {
	title: string;
	step?: number;
	description?: string;
	children: ReactNode;
}) {
	return (
		<FadeIn as="section" className="flex flex-col gap-3">
			<div className="flex flex-col gap-1">
				<h3 className="flex items-center gap-2 text-base font-semibold text-eko-navy">
					{step ? (
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-eko-navy text-xs font-semibold text-white">
							{step}
						</span>
					) : null}
					{title}
				</h3>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{children}
		</FadeIn>
	);
}

/**
 * What the selection costs, and the one number the partner should transfer.
 *
 * Shows the discount as its own line whenever one is running, so the amount
 * being asked for is traceable to the rate card rather than simply asserted.
 * @param fee - The quote for the current selection.
 * @param hasOther - Whether the partner also typed a product we cannot price.
 */
function FeeSummary({
	fee,
	hasOther,
}: {
	fee: ReturnType<typeof calcActivationFee>;
	hasOther: boolean;
}) {
	const discounted = fee.discountPercent > 0 && fee.amount > 0;
	if (fee.amount === 0 && !hasOther) {
		return (
			<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
				Pick the APIs you&rsquo;ve put into production and we&rsquo;ll work out
				what you owe.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3 rounded-md border p-4">
			<dl className="flex flex-col gap-2 text-sm">
				<div className="flex items-baseline justify-between gap-4">
					<dt className="text-muted-foreground">Activation fee</dt>
					<dd className="font-mono">{formatInr(fee.amount)}</dd>
				</div>
				{discounted ? (
					<div className="flex items-baseline justify-between gap-4 text-eko-success">
						<dt>Limited-time offer ({fee.discountPercent}% off)</dt>
						<dd className="font-mono">
							&minus;{formatInr(fee.amount - fee.payable)}
						</dd>
					</div>
				) : null}
				<div className="flex items-baseline justify-between gap-4">
					<dt className="text-muted-foreground">GST (18%)</dt>
					<dd className="font-mono">{formatInr(fee.gst)}</dd>
				</div>
			</dl>

			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-eko-navy/5 p-3">
				<div className="flex flex-col">
					<span className="text-sm font-semibold text-eko-navy">
						Amount to transfer
					</span>
					<span className="text-xs text-muted-foreground">
						Transfer exactly this to Eko&rsquo;s account below.
					</span>
				</div>
				<span className="font-mono text-xl font-semibold text-eko-navy">
					{formatInr(fee.total)}
				</span>
			</div>

			{hasOther ? (
				<p className="text-xs text-muted-foreground">
					We couldn&rsquo;t price what you typed under &ldquo;anything
					else&rdquo; — add its fee to the amount before you transfer, and
					we&rsquo;ll confirm the split.
				</p>
			) : null}

			<p className="text-xs text-muted-foreground">
				Fees come straight from the{" "}
				<Link to="/pricing" className="underline underline-offset-2">
					pricing calculator
				</Link>
				, which can also model your monthly usage.
			</p>
		</div>
	);
}

/**
 * `/console/pay-activation-fee` — the partner tells Eko they have paid the
 * one-time API activation fee.
 *
 * Production credentials unlock every API on the platform, so the fee is
 * collected on trust: this page explains that bargain, shows where to transfer,
 * and collects the transfer's details. It confirms nothing — finance reconciles
 * the claim against the bank statement.
 */
export default function PayActivationFee() {
	const me = useConsoleMe();
	// Whatever upstream already knows. A profile that carries a GST number is
	// never asked for one — the backend would ignore the answer anyway.
	const profileGst = profileGstNumber(me.profile);
	const [form, setForm] = useState<FormState>({
		amount: "",
		date: today(),
		mode: "",
		utr: "",
		depositorName: nameOrBlank(me.profile?.name),
		products: [],
		otherProducts: "",
		gst: "",
	});
	const [touched, setTouched] = useState<
		Partial<Record<TouchableField, boolean>>
	>({});
	// The partner may overwrite the suggested amount — they might be paying two
	// fees at once, or settling a balance. Once they do, the suggestion stops
	// chasing their selection and clobbering what they typed.
	const [amountEdited, setAmountEdited] = useState(false);
	const [productQuery, setProductQuery] = useState("");
	const [slip, setSlip] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const [done, setDone] = useState(false);

	const fee = useMemo(
		() => calcActivationFee(form.products),
		[form.products],
	);

	const visibleGroups = useMemo(
		() => filterFeeProducts(productQuery),
		[productQuery],
	);

	const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const toggleProduct = (id: string) =>
		setForm((prev) => {
			const products = prev.products.includes(id)
				? prev.products.filter((existing) => existing !== id)
				: [...prev.products, id];
			if (amountEdited) return { ...prev, products };
			// Recomputed from the new selection rather than from `fee`, which is
			// still memoised against the previous one at this point.
			const suggested = calcActivationFee(products).total;
			return {
				...prev,
				products,
				amount: suggested > 0 ? String(suggested) : "",
			};
		});

	const errorFor = (field: TouchableField): string | null =>
		touched[field] ? validateField(field, form) : null;

	const isValid = FIELDS.every((field) => !validateField(field, form));

	async function submit(event: FormEvent) {
		event.preventDefault();
		// Reveal every outstanding problem at once rather than one per attempt.
		setTouched(Object.fromEntries(FIELDS.map((field) => [field, true])));
		if (!isValid || busy) return;
		setBusy(true);
		setError(null);
		try {
			const body = new FormData();
			body.append(
				"payload",
				JSON.stringify({
					amount: form.amount.trim(),
					date: form.date,
					mode: form.mode,
					utr: form.utr.trim(),
					depositorName: form.depositorName.trim(),
					// Only ever sent when we had nothing; the backend prefers the
					// profile's own value regardless.
					gst: profileGst ? "" : form.gst.trim(),
					// Ids are the form's currency; the mail wants names.
					products: labelsForFeeProducts(form.products),
					otherProducts: form.otherProducts.trim(),
				}),
			);
			if (slip) body.append("attachment", slip, slip.name);
			const { message } = await authClient.activationFee.intimate(body);
			toast.success(message);
			setDone(true);
		} catch (err) {
			setError(err);
		} finally {
			// Always cleared, so a failed send can be retried — the submit button
			// stays disabled for the whole in-flight call, which is what stops a
			// double click mailing finance twice.
			setBusy(false);
		}
	}

	const partnerName = me.profile?.name?.trim();

	return (
		<div className="flex max-w-3xl flex-col gap-8">
			<Helmet>
				<title>Pay Activation Fee — Developer Console — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>

			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">
					Pay your one-time activation fee
				</h2>
				<p className="text-sm text-muted-foreground">
					You&rsquo;re live in production. Here&rsquo;s how to settle the
					one-time fee for the APIs you&rsquo;ve started using.
				</p>
			</div>

			<Section title="Why we're asking">
				<div className="flex flex-col gap-3 rounded-md border border-dashed p-4 text-sm">
					<p>
						The production credentials you received unlock{" "}
						<strong>every API on the platform</strong> — we don&rsquo;t gate
						them one by one, and we don&rsquo;t make you ask twice.
					</p>
					<p className="text-muted-foreground">
						In return, we trust you to pay the one-time activation fee for
						the APIs you actually use. Tell us which ones you&rsquo;ve put
						into production, and settle the fee for those.
					</p>
				</div>
			</Section>

			<Section
				step={1}
				title="Choose what you're paying for"
				description="Tick every API you've put into production. The fee is charged per API."
			>
				<fieldset className="flex flex-col gap-3" disabled={busy}>
					<legend className="sr-only">Products in production</legend>
					<div className="relative">
						<Search
							aria-hidden
							className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							type="search"
							className="pl-9"
							placeholder="Search APIs…"
							aria-label="Search products"
							value={productQuery}
							onChange={(e) => setProductQuery(e.target.value)}
						/>
					</div>
					<div
						className="flex max-h-72 flex-col gap-4 overflow-y-auto rounded-md border p-4"
						aria-describedby={
							errorFor("products") ? "products-error" : undefined
						}
					>
						{visibleGroups.length === 0 ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No API matches &ldquo;{productQuery.trim()}&rdquo;. Clear the
								search, or name it under &ldquo;anything else&rdquo; below.
							</p>
						) : null}
						{visibleGroups.map((group) => (
							<div key={group.label} className="flex flex-col gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									{group.label}
								</p>
								<div className="grid gap-2 sm:grid-cols-2">
									{group.options.map((option) => (
										<label
											key={option.id}
											className={cn(
												"flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
												form.products.includes(option.id)
													? "border-eko-navy bg-eko-navy/5"
													: "hover:bg-muted/50",
											)}
										>
											<input
												type="checkbox"
												className="size-4 shrink-0"
												checked={form.products.includes(option.id)}
												onChange={() => {
													toggleProduct(option.id);
													setTouched((prev) => ({
														...prev,
														products: true,
													}));
												}}
											/>
											<span className="min-w-0">{option.label}</span>
										</label>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="otherProducts">Anything else (optional)</Label>
						<Input
							id="otherProducts"
							placeholder="An API not listed above"
							value={form.otherProducts}
							onChange={(e) => set("otherProducts", e.target.value)}
						/>
					</div>
					{errorFor("products") ? (
						<p id="products-error" className="text-sm text-destructive">
							{errorFor("products")}
						</p>
					) : null}
				</fieldset>
			</Section>

			<Section
				step={2}
				title="Your one-time activation fee"
				description="Calculated from your selection at today's rates."
			>
				<FeeSummary fee={fee} hasOther={Boolean(form.otherProducts.trim())} />
			</Section>

			<Section
				step={3}
				title="Transfer the amount"
				description="Pay into Eko's collection account by NEFT, IMPS or RTGS."
			>
				<div className="flex flex-col gap-3 rounded-md border p-4">
					<p className="flex items-center gap-2 text-sm font-medium">
						<Landmark aria-hidden className="size-4 text-eko-navy" />
						Eko&rsquo;s bank account
					</p>
					<div className="flex flex-col gap-2">
						{BANK_DETAILS.map((row) => (
							<BankRow key={row.label} label={row.label} value={row.value} />
						))}
					</div>
				</div>
			</Section>

			<Section
				step={4}
				title="Tell us about the transfer"
				description="We'll pass these details to Team Eko, who will confirm once the payment is reconciled."
			>
				{done ? (
					<div
						className="flex items-start gap-3 rounded-md border border-eko-success/40 bg-eko-success/5 p-4"
						role="status"
					>
						<CircleCheck
							aria-hidden
							className="mt-0.5 size-5 shrink-0 text-eko-success"
						/>
						<div className="flex flex-col gap-1 text-sm">
							<p className="font-medium">Payment details sent</p>
							<p className="text-muted-foreground">
								Team Eko has your transfer details
								{partnerName ? ` for ${partnerName}` : ""}. Finance will confirm
								once the payment is reconciled against our bank statement — no
								further action from you.
							</p>
						</div>
					</div>
				) : (
					<form className="flex flex-col gap-6" onSubmit={submit} noValidate>
						<fieldset className="flex flex-col gap-4" disabled={busy}>
							<legend className="sr-only">Transfer details</legend>

							<div className="grid gap-4 sm:grid-cols-2">
								<div className="flex flex-col gap-2">
									<Label htmlFor="amount">Transaction amount (₹)</Label>
									<Input
										id="amount"
										type="number"
										inputMode="decimal"
										min="0"
										step="0.01"
										value={form.amount}
										onChange={(e) => {
											setAmountEdited(true);
											set("amount", e.target.value);
										}}
										onBlur={() =>
											setTouched((prev) => ({ ...prev, amount: true }))
										}
										aria-invalid={errorFor("amount") ? true : undefined}
										aria-describedby={
											errorFor("amount") ? "amount-error" : undefined
										}
									/>
									{errorFor("amount") ? (
										<p id="amount-error" className="text-sm text-destructive">
											{errorFor("amount")}
										</p>
									) : !amountEdited && fee.total > 0 ? (
										<p className="text-xs text-muted-foreground">
											Prefilled from your selection. Edit it if you
											transferred a different amount.
										</p>
									) : null}
								</div>

								<div className="flex flex-col gap-2">
									<Label htmlFor="date">Transaction date</Label>
									<input
										id="date"
										type="date"
										max={today()}
										value={form.date}
										onChange={(e) => set("date", e.target.value)}
										onBlur={() =>
											setTouched((prev) => ({ ...prev, date: true }))
										}
										aria-invalid={errorFor("date") ? true : undefined}
										aria-describedby={
											errorFor("date") ? "date-error" : undefined
										}
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
									/>
									{errorFor("date") ? (
										<p id="date-error" className="text-sm text-destructive">
											{errorFor("date")}
										</p>
									) : null}
								</div>

								<div className="flex flex-col gap-2">
									<Label htmlFor="mode">Mode of payment</Label>
									<select
										id="mode"
										value={form.mode}
										onChange={(e) => set("mode", e.target.value)}
										onBlur={() =>
											setTouched((prev) => ({ ...prev, mode: true }))
										}
										aria-invalid={errorFor("mode") ? true : undefined}
										aria-describedby={
											errorFor("mode") ? "mode-error" : undefined
										}
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
									>
										<option value="">Select…</option>
										{MODES.map((mode) => (
											<option key={mode} value={mode}>
												{mode}
											</option>
										))}
									</select>
									{errorFor("mode") ? (
										<p id="mode-error" className="text-sm text-destructive">
											{errorFor("mode")}
										</p>
									) : null}
								</div>

								<div className="flex flex-col gap-2">
									<Label htmlFor="utr">UTR / reference number</Label>
									<Input
										id="utr"
										value={form.utr}
										placeholder="From your bank's confirmation"
										onChange={(e) => set("utr", e.target.value)}
										onBlur={() =>
											setTouched((prev) => ({ ...prev, utr: true }))
										}
										aria-invalid={errorFor("utr") ? true : undefined}
										aria-describedby={errorFor("utr") ? "utr-error" : undefined}
									/>
									{errorFor("utr") ? (
										<p id="utr-error" className="text-sm text-destructive">
											{errorFor("utr")}
										</p>
									) : null}
								</div>

								<div className="flex flex-col gap-2 sm:col-span-2">
									<Label htmlFor="depositorName">
										Name of depositor (as per bank account)
									</Label>
									<Input
										id="depositorName"
										value={form.depositorName}
										placeholder="Account holder's name"
										onChange={(e) => set("depositorName", e.target.value)}
										onBlur={() =>
											setTouched((prev) => ({
												...prev,
												depositorName: true,
											}))
										}
										aria-invalid={
											errorFor("depositorName") ? true : undefined
										}
										aria-describedby={
											errorFor("depositorName")
												? "depositorName-error"
												: "depositorName-hint"
										}
									/>
									{errorFor("depositorName") ? (
										<p
											id="depositorName-error"
											className="text-sm text-destructive"
										>
											{errorFor("depositorName")}
										</p>
									) : (
										<p
											id="depositorName-hint"
											className="text-xs text-muted-foreground"
										>
											Change it if the transfer came from a different
											account — a director&rsquo;s, or a parent
											company&rsquo;s.
										</p>
									)}
								</div>

								{/* Asked for only when upstream has none. A profile that
								    carries a GST number always wins server-side, so showing
								    the field would invite an answer nobody would read. */}
								{profileGst ? null : (
									<div className="flex flex-col gap-2 sm:col-span-2">
										<Label htmlFor="gst">GST number (optional)</Label>
										<Input
											id="gst"
											value={form.gst}
											placeholder="22AAAAA0000A1Z5"
											onChange={(e) => set("gst", e.target.value)}
											aria-describedby="gst-hint"
										/>
										<p
											id="gst-hint"
											className="text-xs text-muted-foreground"
										>
											We don&rsquo;t have one on file. Add it and
											we&rsquo;ll use it on your invoice.
										</p>
									</div>
								)}
							</div>
						</fieldset>


						<fieldset className="flex flex-col gap-2" disabled={busy}>
							<legend className="text-sm font-medium">
								Transaction slip (optional)
							</legend>
							<FileUpload
								label="Attach your bank's confirmation"
								accept={SLIP_ACCEPT}
								maxBytes={SLIP_MAX_BYTES}
								file={slip}
								onFileChange={setSlip}
							/>
						</fieldset>

						{error ? <ErrorNotice error={error} /> : null}

						<div className="flex items-center gap-3">
							{/* Disabled only while in flight — that is what stops a double
							    click mailing finance twice. NOT disabled on invalid input:
							    a greyed-out button states that something is wrong without
							    ever saying what, so submitting is what reveals the errors. */}
							<Button type="submit" disabled={busy}>
								{busy ? "Sending…" : "Send payment details"}
							</Button>
							<p className="text-xs text-muted-foreground">
								We&rsquo;ll email these to Team Eko for confirmation.
							</p>
						</div>
					</form>
				)}
			</Section>
		</div>
	);
}
