/**
 * Platform-agnostic FAQ data — the single source for the global `/faq` page,
 * the per-product FAQ sections, the `/docs/faqs` integration guide, `/faq.md`
 * and the FAQPage JSON-LD.
 *
 * Deliberately light on imports (no lucide icons, no image assets) so the
 * build-time markdown renderers and their vitest suites can load it inside the
 * Node/SSR context without dragging in the product-page config.
 *
 * Answers are **markdown** — bold, inline code, links and bullet lists are
 * rendered by `FaqSection`. See `stripMarkdown` in `@/lib/utils` for the
 * subset that is flattened back to plain text for JSON-LD and search.
 */

import { SIGNUP_URL } from "@/lib/config/site";
import { API_ENVIRONMENTS } from "./api-auth";

/**
 * Display categories. Mutually exclusive by design: `/docs/faqs` renders one
 * section per tag, so a second tag would make the same FAQ appear twice.
 */
export const FAQ_TAGS = [
	"getting-started",
	"auth",
	"testing",
	"integration",
	"ai",
	"support",
	"pricing",
	"compliance",
] as const;

export type FaqTag = (typeof FAQ_TAGS)[number];

/** Optional "Also See" cross-link rendered beneath an FAQ answer. */
export interface FaqLink {
	label: string;
	href: string;
}

export interface FAQ {
	q: string;
	/** Markdown: bold, inline code, links and bullet lists. */
	a: string;
	/** Optional "Also See" links shown beneath the answer. */
	links?: FaqLink[];
	/** Display category. Required on the global FAQs, optional on product ones. */
	tag?: FaqTag;
}

/** FAQs whose category is one of `tags`, in source order. */
export const faqsByTag = (faqs: FAQ[], tags: FaqTag[]): FAQ[] =>
	faqs.filter((faq) => faq.tag !== undefined && tags.includes(faq.tag));

/**
 * Parse a comma-separated tag list (e.g. the `<FaqList tags="auth,testing" />`
 * prop) into typed tags, throwing on anything unknown so a typo fails loudly at
 * render/build time instead of silently rendering a short list.
 *
 * @param input - Comma-separated tag names.
 * @throws If any tag is not a member of {@link FAQ_TAGS}.
 */
export const parseFaqTags = (input: string): FaqTag[] => {
	const parsed = input
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
	const unknown = parsed.filter(
		(tag) => !(FAQ_TAGS as readonly string[]).includes(tag),
	);
	if (unknown.length) {
		throw new Error(
			`Unknown FAQ tag(s): ${unknown.join(", ")}. Valid tags: ${FAQ_TAGS.join(", ")}.`,
		);
	}
	return parsed as FaqTag[];
};

/**
 * Platform-agnostic FAQs that appear on EVERY product page (appended after each
 * product's own FAQs) and on the global `/faq` page. Buying-intent / pre-
 * integration questions live here. Anything product-specific belongs in
 * {@link GLOBAL_REFERENCE_FAQS} instead — these are shown on all 29 product pages.
 */
export const COMMON_API_FAQS: FAQ[] = [
	{
		q: "How do I get started?",
		a: `Four steps: **sign up** at [ekostore.app/eps](${SIGNUP_URL}), verify your identity with PAN and address details, load your wallet to test the APIs live, then integrate and go live. Sandbox credentials are issued immediately — you can call your first endpoint before any paperwork clears.`,
		tag: "getting-started",
		links: [
			{ label: "Developer docs", href: "/docs" },
			{ label: "Sign up", href: SIGNUP_URL },
		],
	},
	{
		q: "What is EPS?",
		a: "**EPS (Eko Platform Services)** is the technology arm of Eko — the developer tools, AI tooling and APIs that power modern fintech integration, from money transfer and AePS to identity verification.",
		tag: "getting-started",
		links: [{ label: "About Eko", href: "/about" }],
	},
	{
		q: "What are the different ways to integrate with Eko EPS?",
		a: "Three paths, pick whichever suits your stack:\n\n- Call the **REST APIs** directly.\n- Use our official **JavaScript / PHP SDKs** to skip request-signing boilerplate.\n- Let an **AI coding agent** build it via our [MCP server and agent skills](/ai#install).\n\nFor multi-step flows (onboard a sender, *then* transfer) start from a [transaction-flow recipe](/recipe) rather than wiring single endpoints together yourself.",
		tag: "integration",
		links: [
			{ label: "SDKs & developer docs", href: "/docs" },
			{ label: "Integrate with AI", href: "/ai" },
		],
	},
	{
		q: "How does API authentication work?",
		a: "Each request carries your static `developer_key` header plus a per-request `secret-key` header — an **HMAC-SHA256** signature of the current timestamp, keyed by your access key. The access key itself is **never sent over the wire**. You receive UAT keys on signup and production keys after KYC.\n\nThe [How Authentication Works](/docs/how-auth-works) guide has the full signing recipe in five languages plus an **in-browser playground** that generates and verifies a real `secret-key` against your own access key.",
		tag: "auth",
		links: [
			{ label: "How auth works", href: "/docs/how-auth-works" },
			{ label: "Set up auth with AI", href: "/ai#install" },
		],
	},
	{
		q: "Is there a sandbox environment for testing?",
		a: "Yes. A full **sandbox** is available immediately on signup — test your integration end-to-end before going live, no commitment required. For offline work you can also run our [mock server](/ai#artifacts) (`npx -y @ekoindia/eps-mock-server`) and get canned responses with no network calls at all.",
		tag: "testing",
		links: [{ label: "Get started", href: "/docs" }],
	},
	{
		q: "What are the sandbox and production base URLs?",
		// Base URLs come from the shared environment config — never hard-code them.
		a: `Sandbox and production share the same paths and differ **only** by base URL:\n\n- ${API_ENVIRONMENTS.sandbox.label} — \`${API_ENVIRONMENTS.sandbox.baseUrl}\`\n- ${API_ENVIRONMENTS.production.label} — \`${API_ENVIRONMENTS.production.baseUrl}\`\n\nA common cause of failures is calling the sandbox URL with live credentials, or vice-versa — **make sure the base URL matches the keys you are using**.`,
		tag: "testing",
		links: [
			{ label: "Get started", href: "/docs" },
			{ label: "How auth works", href: "/docs/how-auth-works" },
		],
	},
	{
		q: "Do I need to whitelist my server IP?",
		a: "Production API access may require your **static public (server) IP** to be whitelisted. If your calls work from Postman but fail or time out from your own server, that is almost always the cause — share your static public IP with us so we can whitelist it.",
		tag: "integration",
		links: [{ label: "Developer docs", href: "/docs" }],
	},
	{
		q: "Can an AI coding agent build the integration for me?",
		a: "Yes — that is the fastest path. Point your agent (Claude Code, Codex, Cursor, Copilot, …) at our **MCP server** and it can look up any endpoint, generate correctly-signed requests, and scaffold the integration in your own stack. Install it in [one step from the AI hub](/ai#install), or start from a [ready-made prompt](/ai#quick-start).\n\nWe also publish an **OpenAPI 3.1 spec**, a **Postman collection** and per-agent **context packs** (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`) so an agent has the ground truth instead of guessing.",
		tag: "ai",
		links: [
			{ label: "AI tools & MCP server", href: "/ai" },
			{ label: "Quick start prompt", href: "/ai#quick-start" },
		],
	},
	{
		q: "What response times can I expect?",
		a: "Most verification APIs return in **real time with sub-second responses**, and 99th-percentile latency stays under two seconds across verification endpoints. Transaction APIs (DMT, AePS, BBPS) respond within seconds.",
		tag: "integration",
	},
	{
		q: "Can the API handle high volumes?",
		a: "Yes. The API is designed to handle **large-scale volumes** reliably without performance degradation.",
		tag: "integration",
	},
	{
		q: "How is API usage billed?",
		a: "Usage is billed **per successful API call** with no minimum commitment. Volume-based pricing tiers are available — see the [pricing calculator](/pricing) for indicative rates, or contact our team for a custom quote.",
		tag: "pricing",
		links: [{ label: "Pricing & calculator", href: "/pricing" }],
	},
];

/**
 * Reference FAQs shown ONLY on the global `/faq` page and `/docs/faqs` — deeper,
 * long-tail or product-specific questions that would bloat every product page.
 * NOT appended to product pages.
 */
export const GLOBAL_REFERENCE_FAQS: FAQ[] = [
	{
		q: "How are errors and failures reported?",
		a: "Every response carries a `status` code (`0` = success), a `response_status_id` and a human-readable `message`. **A `200 OK` with a non-zero `response_status_id` is a business failure, not a transport success** — always check both before treating a call as done. The [Status & Error Codes](/docs/error-codes) reference lists every code and what to do about it.",
		tag: "integration",
		links: [{ label: "Error codes reference", href: "/docs/error-codes" }],
	},
	{
		q: "How does API versioning work?",
		a: "Eko APIs are versioned **in the base path** (currently `v3`). Sandbox and production share the same paths and differ only by base URL, so promoting an integration from UAT to live is a base-URL and credentials change — not a code change.",
		tag: "integration",
		links: [{ label: "Developer docs", href: "/docs" }],
	},
	{
		q: "How do I capture an Aadhaar fingerprint or biometric?",
		a: "Through a **UIDAI registered device (RDService)** — the scanner returns a signed, encrypted PID block that you pass straight through to the API. Never capture or store raw biometrics yourself.\n\nThe [Aadhaar Biometric Auth (RDService)](/docs/aadhaar-biometric-rdservice) guide covers both the Windows/Web and Android capture paths, and includes an **in-browser device tester** — plug in your scanner and confirm it works before writing any code.",
		tag: "integration",
		links: [
			{
				label: "RDService guide & device tester",
				href: "/docs/aadhaar-biometric-rdservice",
			},
		],
	},
	{
		q: "How do I chain multiple API calls into one flow?",
		a: "Most real use cases are multi-step — onboard a customer, verify them, *then* transact. Rather than stitching endpoints together from the reference, start from a [**transaction flow recipe**](/recipe): each one is an ordered runbook showing which endpoint to call at each step and how to branch on `response_status_id`.\n\nThe same recipes are available to AI agents through our [MCP server](/ai#install), so an agent can execute a whole flow end to end.",
		tag: "integration",
		links: [{ label: "Transaction flows (recipes)", href: "/recipe" }],
	},
	{
		q: "What data privacy and compliance standards does Eko follow?",
		a: "Eko follows applicable **RBI** and data-protection guidelines for its regulated banking and KYC services. Aadhaar-based KYC is performed **only with explicit customer consent**.",
		tag: "compliance",
	},
	{
		q: "How do I report an integration issue?",
		a: 'Share the complete request and response so we can debug in one round trip:\n\n- The full `curl` (including headers)\n- The response body, verbatim\n- The timestamp of the call\n- Your `initiator_id`, `user_code` and `client_ref_id`\n\nIssues raised with these details are resolved **much** faster than "the API is failing".',
		tag: "support",
	},
	{
		q: "Are there any common integration gotchas to know?",
		a: "Three frequent ones:\n\n- `client_ref_id` must be **at most 20 characters** and unique per request.\n- Calling the sandbox base URL with live credentials (or vice-versa) fails auth — see [How Authentication Works](/docs/how-auth-works).\n- The `JSESSIONID` cookie Postman adds automatically is **harmless** — it has no effect on the API and can be ignored.",
		tag: "integration",
		links: [{ label: "Error codes reference", href: "/docs/error-codes" }],
	},
	{
		q: "Where can I find the developer integration FAQ?",
		a: "Inside the API docs: [**Integration FAQs**](/docs/faqs) collects the credential, signing, environment, error-handling and support questions in one place, right next to the endpoint reference and guides.",
		tag: "support",
		links: [{ label: "Integration FAQs", href: "/docs/faqs" }],
	},
];

/**
 * The full set shown on the global `/faq` page: product-scoped commons first,
 * then global-only reference FAQs.
 */
export const GLOBAL_FAQS: FAQ[] = [
	...COMMON_API_FAQS,
	...GLOBAL_REFERENCE_FAQS,
];
