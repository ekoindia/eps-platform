import { LoginForm } from "@/components/auth/LoginForm";
import {
	BarChart3,
	Check,
	Code2,
	FlaskConical,
	IdCard,
	type LucideIcon,
	Sparkles,
	UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The four required steps of the onboarding journey shown beside the sign-in
 * form. Copy is deliberately outcome-first ("in hours, not weeks"), because
 * this is the only pitch an anonymous developer sees before handing over a
 * mobile number.
 *
 * Trying the verification APIs from the console is *not* one of these — it is
 * an optional detour off step 1, rendered as its own card by {@link Journey}.
 *
 * The pastel `tint`s are one-off illustration colours, not semantic tokens —
 * they exist to separate four adjacent icons, and nothing else in the app
 * consumes them.
 */
const STEPS: ReadonlyArray<{
	Icon: LucideIcon;
	tint: string;
	title: string;
	body: string;
}> = [
	{
		Icon: UserPlus,
		tint: "bg-[#fdf1d7]",
		title: "Finish your quick signup to get started",
		body: "Fully digital, takes minutes — receive your UAT credentials immediately after signup.",
	},
	{
		Icon: Code2,
		tint: "bg-[#e6f1f5]",
		title: "Build your integration in hours, not weeks",
		body: "Develop against the sandbox with your UAT keys — our SDKs, quickstarts and AI tools do the heavy lifting.",
	},
	{
		Icon: IdCard,
		tint: "bg-[#efeaf9]",
		title: "Finish your KYC to receive production credentials",
		body: "Upload a few documents to verify your identity and business. Receive live credentials once we verify your docs.",
	},
	{
		Icon: BarChart3,
		tint: "bg-[#e7f5ec]",
		title: "Run your business from the dashboard",
		body: "Top up your wallet and track your transactions, statements and settlement reports — live, exportable.",
	},
];

const EYEBROW = "text-[0.6875rem] font-bold uppercase tracking-[0.12em]";

/** The dashed segment of timeline that runs into the next row of the journey. */
const CONNECTOR = (
	<div className="ml-[1.3125rem] h-5 border-l-2 border-dashed border-[#e3dcc9]" />
);

/**
 * The API trial, hung off step 1 on the same timeline but drawn as a card with
 * a dashed outline and no step number — everything about it says "you may skip
 * this". It lives inside step 1's `<li>` so the list still counts four steps;
 * the `<aside>` keeps it from reading as more of step 1 to a screen reader.
 */
function OptionalTrial() {
	return (
		<>
			{CONNECTOR}
			<aside
				className="flex items-start gap-4"
				aria-label="Optional: try the verification APIs"
			>
				<div className="flex size-11 flex-none items-center justify-center rounded-[0.8125rem] border-2 border-dashed border-[#e3dcc9] bg-[#faf9f5]">
					<FlaskConical className="size-5 text-eko-slate" strokeWidth={1.8} />
				</div>
				<div className="max-w-[29.5rem] flex-1 rounded-xl border border-dashed border-[#e3dcc9] bg-[#f7f3ea] p-4 pb-2">
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
						<span
							className={`${EYEBROW} rounded-full border border-[#e6d6a8] bg-white px-2.5 py-0.5 text-eko-navy`}
						>
							Optional
						</span>
						<span className="text-[0.8125rem] text-eko-slate">
							{/* Desktop has room for the full qualifier; mobile does not. */}
							<span className="hidden lg:inline">available right </span>after
							signup
						</span>
					</div>
					<h3 className="mt-2 text-[0.95rem] font-bold text-eko-navy">
						Try verification APIs live before you build
					</h3>
					<div className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
						Run live PAN, Aadhaar, bank-account and UPI checks from the console
						UI — zero code.
					</div>
				</div>
			</aside>
		</>
	);
}

/**
 * What happens after the number is submitted, one card per audience. The widget
 * serves returning developers and first-timers through the same OTP, and a
 * heading alone was not saying so — returning users read "create your account"
 * and assumed they were on the wrong screen.
 *
 * Brand tokens at low alpha rather than raw palette colours: the two cards have
 * to read as a pair of tints under the gold submit button, not as status
 * banners.
 */
const REASSURANCE: ReadonlyArray<{
	Icon: LucideIcon;
	dot: string;
	card: string;
	title: string;
	body: string;
}> = [
	{
		Icon: Check,
		dot: "bg-eko-success",
		card: "border-eko-success/25 bg-eko-success/5",
		title: "Have an account?",
		body: "We will take you straight to your dashboard.",
	},
	{
		Icon: Sparkles,
		dot: "bg-eko-gold",
		card: "border-eko-gold/40 bg-eko-gold-light",
		title: "First time?",
		body: "We set up your account next. Free to start. Takes 2 minutes.",
	},
];

/**
 * The pair of audience cards shown under the mobile-step button. Handed to
 * {@link LoginForm} as `mobileStepFooter` so it disappears with that step — by
 * the time the OTP boxes are up, the question it answers has been answered.
 */
function Reassurance() {
	return (
		<div className="mt-5 grid gap-3 sm:grid-cols-2">
			{REASSURANCE.map(({ Icon, dot, card, title, body }) => (
				<div key={title} className={`flex gap-2 rounded-xl border p-3 ${card}`}>
					<span
						className={`mt-0.5 flex size-[1.125rem] flex-none items-center justify-center rounded-full ${dot}`}
						aria-hidden="true"
					>
						<Icon className="size-3 text-white" strokeWidth={3} />
					</span>
					<div>
						<h3 className="text-[0.8125rem] font-bold text-eko-navy">
							{title}
						</h3>
						<div className="mt-0.5 text-[0.8125rem] leading-relaxed text-eko-slate">
							{body}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

/** The four-step journey, rendered with a dashed connector between items. */
function Journey() {
	return (
		<ol className="flex flex-col">
			{STEPS.map(({ Icon, tint, title, body }, i) => (
				<li key={title}>
					{/* Connector, not a separate list item: it belongs to the step it
					    leads into, so the list still has exactly four entries. */}
					{i > 0 ? CONNECTOR : null}
					<div className="flex items-start gap-4">
						<div
							className={`flex size-11 flex-none items-center justify-center rounded-[0.8125rem] ${tint}`}
						>
							<Icon className="size-5 text-eko-navy" strokeWidth={1.8} />
						</div>
						<div>
							<div className={`${EYEBROW} text-eko-gold-ink`}>
								Step {String(i + 1).padStart(2, "0")}
							</div>
							<h3 className="mt-0.5 text-[0.95rem] font-bold text-eko-navy">
								{title}
							</h3>
							<div className="mt-0.5 max-w-[27.5rem] text-[0.8125rem] leading-relaxed text-muted-foreground">
								{body}
							</div>
						</div>
					</div>
					{i === 0 ? <OptionalTrial /> : null}
				</li>
			))}
		</ol>
	);
}

/**
 * The logged-out entry screen for `/console` and `/signup`: a full-bleed split
 * pairing the developer-onboarding pitch with the mobile-OTP form.
 *
 * Auth state stays with the callers — this component only renders, and forwards
 * both props straight through to {@link LoginForm}.
 *
 * @param onSuccess - Called once the session has been adopted.
 * @param prefetch - Warm-up for whatever renders after login; see `LoginForm`.
 */
export function SignInSplit({
	onSuccess,
	prefetch,
}: {
	onSuccess?: () => void;
	prefetch?: () => Promise<unknown>;
}) {
	return (
		// Two-tone: the pitch sits on warm paper, the form on white. Below `lg`
		// the whole thing is paper and the form becomes a floating card instead.
		//
		// The section starts at y=0, under the fixed header, so each column paints
		// its own background all the way up — clearing the header with a padded
		// `<main>` instead would strand a strip of page background above the split.
		// The columns that touch the top edge therefore carry `--header-h` in their
		// own top padding, which also keeps the form optically centred in the space
		// the header leaves rather than in the whole viewport.
		<section className="grid [--header-h:5.5rem] bg-[#faf9f5] lg:min-h-screen lg:grid-cols-[58fr_42fr] lg:grid-rows-[auto_1fr]">
			<div className="order-1 px-5 pt-[calc(var(--header-h)+1.75rem)] sm:px-8 lg:col-start-1 lg:row-start-1 lg:px-14 lg:pt-[calc(var(--header-h)+3rem)]">
				<div className={`${EYEBROW} text-eko-gold-ink`}>
					EPS Developer Console
				</div>
				<h1 className="mt-3 max-w-[35rem] text-[1.625rem] font-extrabold leading-tight text-pretty text-eko-navy lg:text-[2.375rem]">
					From sign-up to{" "}
					{/* Marker-pen highlight. The band is placed in `em` measured up from
					    the bottom of the inline box, not as a percentage of it: the box
					    runs to the descender, so a percentage stop drops the wash below
					    the baseline and the highlight reads as an underline. 0.18em–0.62em
					    lands it across the lower two-thirds of the x-height.
					    `box-decoration-clone` gives each line fragment its own band, so a
					    phrase that wraps stays highlighted on both lines. */}
					<span className="box-decoration-clone bg-[linear-gradient(to_top,transparent_0.18em,#fde39a_0.18em,#fde39a_0.62em,transparent_0.62em)]">
						first API call
					</span>{" "}
					in a day
				</h1>
				<p className="mt-3.5 hidden max-w-[31.25rem] text-[0.9375rem] leading-relaxed text-eko-slate lg:block">
					The Developer Console walks you through everything — here's the whole
					journey.
				</p>
			</div>

			<div className="order-2 px-5 py-5 sm:px-8 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:items-center lg:justify-center lg:border-l lg:border-[#eee9dd] lg:bg-white lg:px-10 lg:pb-12 lg:pt-[calc(var(--header-h)+3rem)]">
				{/* A card on mobile, a flat panel on desktop — one element, because
				    only the chrome differs between the two. */}
				<div className="rounded-2xl border border-[#eee9dd] bg-white p-6 shadow-card lg:w-[24.75rem] lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
					<h2 className="text-lg font-extrabold text-eko-navy lg:text-[1.375rem]">
						Log in or sign up
					</h2>
					<p className="mt-1.5 text-[0.84375rem] leading-relaxed text-eko-slate">
						Free to start. No credit card required.
					</p>
					<div className="mt-5">
						<LoginForm
							onSuccess={onSuccess}
							prefetch={prefetch}
							submitLabel="Send OTP to my mobile"
							mobileStepFooter={<Reassurance />}
						/>
					</div>
					<p className="mt-6 text-[0.71875rem] leading-relaxed text-muted-foreground">
						By continuing you agree to Eko's{" "}
						<Link to="/tnc" className="text-eko-navy underline">
							Terms &amp; Conditions
						</Link>{" "}
						and{" "}
						<Link to="/privacy-policy" className="text-eko-navy underline">
							Privacy Policy
						</Link>
						.
					</p>
				</div>
			</div>

			<div className="order-3 px-5 pb-8 pt-4 sm:px-8 lg:col-start-1 lg:row-start-2 lg:px-14 lg:pb-12 lg:pt-6">
				{/* Desktop gets the lead paragraph above instead; on mobile the journey
				    is far enough from the hero to need its own label. */}
				<div className={`${EYEBROW} mb-4 text-eko-gold-ink lg:hidden`}>
					The whole journey
				</div>
				<Journey />
			</div>
		</section>
	);
}
