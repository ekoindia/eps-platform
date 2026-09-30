/**
 * Safety & security facts — the single source for the `/security` page, its
 * `/security.md` twin, the `security`-tagged FAQs, the DMT/AePS/BBPS product
 * FAQs and the context-MCP `security` topic.
 *
 * Every statement here is IT-confirmed public copy. Do NOT strengthen a claim
 * (e.g. "audited against" → "certified") or add a new one without IT/legal
 * sign-off — see `docs/security-page.md`.
 *
 * Light on imports (no icons, no assets) so the build-time markdown renderers
 * and the agent-bundle builder can load it in the Node/SSR context.
 */

import { ACTIVE_PRODUCTS_MAP } from "./api-products";
import { DMT_MAX_TXN_AMOUNT } from "./dmt-pricing";

/** AePS cash withdrawals above this amount (₹) also need an SMS OTP. */
export const AEPS_OTP_THRESHOLD = 5000;

/** `client_ref_id` length rule: 10 is the minimum and the recommended length. */
export const CLIENT_REF_ID_LENGTH = { min: 10, max: 20 } as const;

/** Site path of the security page; FAQ links anchor into its sections. */
export const SECURITY_PATH = "/security";

/** Shared by the page `<Helmet>` and the `/security.md` front matter. */
export const SECURITY_PAGE_TITLE =
	"Security & Data Protection | Eko Platform Services API";
export const SECURITY_PAGE_DESCRIPTION =
	"How Eko keeps partner data and transactions safe: Azure hosting in India (Pune primary, Chennai DR), no Aadhaar or biometric storage, annual ISO/IEC 27001 audits, HMAC-signed APIs over TLS 1.2+, and OTP/biometric transaction safeguards.";

const inr = (amount: number): string => `₹${amount.toLocaleString("en-IN")}`;

/**
 * How each transaction product authenticates the customer. Shared verbatim by
 * the page's transaction section and the matching product-page FAQ.
 */
export const TRANSACTION_AUTH = {
	dmt: `Senders complete a **one-time biometric Aadhaar eKYC**. Every transfer after that requires a **fresh OTP** sent to the sender's registered mobile. Transfers are capped at **${inr(DMT_MAX_TXN_AMOUNT)} per transaction**, and sender-level monthly limits apply.`,
	aeps: `Agents complete a **one-time eKYC** plus a **biometric authentication each day** before transacting. Customer withdrawals are authorised by fingerprint through **UIDAI-certified RD-service devices**, and withdrawals above **${inr(AEPS_OTP_THRESHOLD)}** also need an SMS OTP.`,
	bbps: "Bill amounts are **fetched live from the biller**. Whenever a biller supports bill-fetch, the amount paid can **never exceed the fetched bill amount**.",
} as const;

/** Product id (in `api-products.ts`) whose security copy is gated on it. */
export type TransactionProductId = keyof typeof TRANSACTION_AUTH;

/** Display labels: `label` for page bullets, `noun` for the FAQ question. */
const TRANSACTION_PRODUCTS: {
	id: TransactionProductId;
	label: string;
	noun: string;
}[] = [
	{ id: "dmt", label: "Money transfers (DMT)", noun: "money transfers" },
	{ id: "aeps", label: "AePS", noun: "AePS" },
	{ id: "bbps", label: "Bill payments (BBPS)", noun: "bill payments" },
];

/** True when a product is live on the site (not `disabled` in `api-products.ts`). */
export type IsProductActive = (productId: TransactionProductId) => boolean;

const isProductActive: IsProductActive = (productId) =>
	productId in ACTIVE_PRODUCTS_MAP;

/**
 * A bullet: plain markdown, or product-specific markdown that is dropped
 * everywhere (page, `.md`, MCP) while that product is disabled.
 */
type SecurityPoint = string | { productId: TransactionProductId; text: string };

interface SecuritySectionSource extends Omit<SecuritySection, "points"> {
	points: SecurityPoint[];
}

export interface SecuritySection {
	/** Anchor id on the page (`/security#<id>`). */
	id: string;
	title: string;
	/** One-line lede shown under the heading. */
	summary: string;
	/** Markdown bullets: bold, inline code and links. */
	points: string[];
}

const SECURITY_SECTION_SOURCES: SecuritySectionSource[] = [
	{
		id: "infrastructure",
		title: "Infrastructure & data residency",
		summary: "Where your data lives and what we never keep.",
		points: [
			"The entire application and database run on **Microsoft Azure**, with a primary data centre in **Central India (Pune)** and a disaster-recovery site in **South India (Chennai)**. These are two geographically separate regions, so services continue if one region fails.",
			"All data is **stored and processed within India**, in line with RBI's data-localisation requirements.",
			"**Aadhaar numbers are never stored.** Biometric data (fingerprints / PID blocks) is passed directly through for authentication and **never retained**.",
			"We retain no data that UIDAI, RBI or other applicable regulations prohibit us from storing.",
		],
	},
	{
		id: "compliance",
		title: "Independent audit & compliance",
		summary: "External checks on our controls, every year.",
		points: [
			"**RBI-empanelled auditors** independently audit our information-security controls **every year against ISO/IEC 27001**.",
			"The platform complies with **RBI regulations** for payment services and Business Correspondent operations, as well as **KYC** and **AML/CFT** norms.",
		],
	},
	{
		id: "api-security",
		title: "API & access security",
		summary: "How calls to the platform are authenticated and protected.",
		points: [
			"Every API request is signed with **HMAC-SHA256** using a private key issued to your account. This authenticates the caller and detects any tampering with the request. See [How Authentication Works](/docs/how-auth-works).",
			"Credentials are designed to **stay server-side**. Our official SDKs (Node.js, Python, PHP, Go, Java) are **backend-only** and handle signing automatically, so keys are never exposed in client apps.",
			"Separate **sandbox and production** environments let you build and test without touching live data or money.",
			"All traffic is encrypted in transit over **TLS 1.2+**.",
			"**IP whitelisting** is available as an optional extra layer of security for **production** access.",
		],
	},
	{
		id: "transactions",
		title: "Transaction security",
		summary: "Customer authentication and safeguards on every money movement.",
		points: [
			...TRANSACTION_PRODUCTS.map(({ id, label }) => ({
				productId: id,
				text: `**${label}:** ${TRANSACTION_AUTH[id]}`,
			})),
			`Each transaction carries a unique \`client_ref_id\` (${CLIENT_REF_ID_LENGTH.min}–${CLIENT_REF_ID_LENGTH.max} characters; ${CLIENT_REF_ID_LENGTH.min} recommended). The [Transaction Inquiry API](/docs/transaction-inquiry) lets you confirm the status of any pending or timed-out transaction **before retrying**.`,
			"Regulatory limits are enforced on the platform.",
		],
	},
	{
		id: "audit-trail",
		title: "Audit trail & reconciliation",
		summary: "Records you can use for your own audits and reporting.",
		points: [
			"Full transaction logs, reconciliation data and settlement reports are maintained for audit and reporting.",
			"**Reconciliation and settlement reports are shared over email on request.**",
		],
	},
];

/**
 * Sections with product-specific bullets of inactive products removed.
 * Exported for tests; everything else uses {@link SECURITY_SECTIONS}.
 */
export const resolveSecuritySections = (
	isActive: IsProductActive,
): SecuritySection[] =>
	SECURITY_SECTION_SOURCES.map((section) => ({
		...section,
		points: section.points.flatMap((point) =>
			typeof point === "string"
				? [point]
				: isActive(point.productId)
					? [point.text]
					: [],
		),
	}));

/** Sections as published: only bullets for currently-enabled products. */
export const SECURITY_SECTIONS: SecuritySection[] =
	resolveSecuritySections(isProductActive);

const anchor = (id: string): string => `${SECURITY_PATH}#${id}`;

/** "a", "a and b", "a, b and c". */
const joinNouns = (nouns: string[]): string =>
	nouns.length < 2
		? nouns.join("")
		: `${nouns.slice(0, -1).join(", ")} and ${nouns.at(-1)}`;

/**
 * The per-product authentication FAQ, covering only enabled products; `[]`
 * when none is enabled.
 */
const transactionAuthFaq = (isActive: IsProductActive) => {
	const active = TRANSACTION_PRODUCTS.filter(({ id }) => isActive(id));
	if (!active.length) return [];
	const [first] = active;
	return [
		{
			q: `How are ${joinNouns(active.map((p) => p.noun))} authenticated?`,
			a:
				active.length === 1
					? TRANSACTION_AUTH[first.id]
					: active
							.map(({ id, label }) => `- **${label}:** ${TRANSACTION_AUTH[id]}`)
							.join("\n"),
			links: [{ label: "Transaction security", href: anchor("transactions") }],
		},
	];
};

/**
 * Security questions partners ask during due diligence. Tagged `security`;
 * each links to the matching `/security` section. Typed structurally (not via
 * `FAQ`) because `common-faqs.ts` imports this module.
 */
export const SECURITY_FAQS = [
	{
		q: "Where is my data stored and processed?",
		a: "Only in **India**. The platform runs on **Microsoft Azure**, with a primary data centre in Central India (Pune) and a disaster-recovery site in South India (Chennai), in line with RBI's data-localisation requirements.",
		links: [
			{
				label: "Infrastructure & data residency",
				href: anchor("infrastructure"),
			},
		],
	},
	{
		q: "Does Eko store Aadhaar numbers or biometric data?",
		a: "No. **Aadhaar numbers are never stored**, and biometric data (fingerprints / PID blocks) is passed straight through for authentication and never retained. We retain no data that UIDAI, RBI or other applicable regulations prohibit us from storing.",
		links: [
			{
				label: "Infrastructure & data residency",
				href: anchor("infrastructure"),
			},
		],
	},
	{
		q: "Is the platform independently audited? Which regulations does it follow?",
		a: "Yes. **RBI-empanelled auditors** audit our information-security controls every year **against ISO/IEC 27001**. The platform complies with RBI regulations for payment services and Business Correspondent operations, and with **KYC** and **AML/CFT** norms. Aadhaar-based KYC is performed only with explicit customer consent.",
		links: [{ label: "Audit & compliance", href: anchor("compliance") }],
	},
	{
		q: "What API security controls are in place?",
		a: "Every request is **HMAC-SHA256 signed** with a private key issued to your account, all traffic uses **TLS 1.2+**, and our SDKs are backend-only so keys never reach client apps. Sandbox and production are separate, and **IP whitelisting** is available as an optional extra layer for production.",
		links: [{ label: "API & access security", href: anchor("api-security") }],
	},
	...transactionAuthFaq(isProductActive),
	{
		q: "How do I avoid duplicate transactions after a timeout?",
		a: `Send a unique \`client_ref_id\` (${CLIENT_REF_ID_LENGTH.min}–${CLIENT_REF_ID_LENGTH.max} characters) with every transaction. If a call is pending or times out, **don't treat it as failed** — confirm its status with the [Transaction Inquiry API](/docs/transaction-inquiry) using that reference before retrying.`,
		links: [{ label: "Transaction security", href: anchor("transactions") }],
	},
	{
		q: "Can I get transaction logs and reconciliation reports for audits?",
		a: "Yes. Full transaction logs, reconciliation data and settlement reports are maintained for audit and reporting, and **reconciliation and settlement reports are shared over email on request**.",
		links: [
			{ label: "Audit trail & reconciliation", href: anchor("audit-trail") },
		],
	},
].map((faq) => ({ ...faq, tag: "security" as const }));
