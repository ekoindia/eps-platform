import type { DashboardView, DatePreset } from "@/lib/console/dashboard";
import type {
	TransactionFilters,
	TransactionPage,
} from "@/lib/console/transactions";

const BASE: string = import.meta.env.VITE_EPS_BACKEND_URL ?? "/api";

/**
 * Every lifecycle the backend can report, as a runtime value so a `/me` payload
 * can actually be checked against it — a type alone would leave `state` to be
 * trusted on faith.
 */
export const LIFECYCLES = [
	"lead",
	"onboarded",
	"active",
	"inactive",
	"unknown",
] as const;

export type Lifecycle = (typeof LIFECYCLES)[number];

export interface Profile {
	name: string;
	email: string;
	mobile: string;
	code: string | number;
	userType: string;
	ekoUserId: string;
	roleList: string[];
	orgId: number;
	dateOfJoining?: string;
	onboarding: number;
	zohoId: string;
	/** Ordered onboarding steps from upstream; empty for a fully-onboarded user. */
	onboardingSteps: Array<{ role: number; label: string }>;
}

export interface MeView {
	state: Lifecycle;
	mobile: string;
	profile: Profile | null;
	zohoId: string | null;
}

/** The developer's E-value wallet balance, in rupees. */
export interface WalletBalanceView {
	balance: number;
}

export interface AdminView {
	role: "admin";
	login: string | null;
	sub: string;
}

/** The `/me` view for a user partway through signup. */
export interface SignupView {
	role: "signup";
	mobile: string;
}

/** One onboarding step, as named by the backend. */
export interface SignupStep {
	role: number;
	label: string;
}

/**
 * Server-authoritative onboarding progress. The wizard renders this and never
 * infers progress locally — every step call returns a fresh copy.
 */
export interface SignupState {
	mobile: string;
	/** `new` = no partial account yet; `done` = onboarding complete. */
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	currentRole: number | null;
	/** Profile display name, when an upstream record carries one. */
	name?: string;
	/** Profile email, when an upstream record carries one. */
	email?: string;
}

/** The e-sign URL details for the Sign Agreement step, from the backend. */
export interface SignUrlView {
	/** Provider signing URL; empty when `alreadySigned`. */
	shortUrl: string;
	/** Document id echoed back on submit. */
	documentId: string;
	/** Provider id (0 DigiO, 1 Karza, 2 Signzy, 3 Leegality). */
	pipe: number;
	/** True when upstream reports the agreement is already signed. */
	alreadySigned: boolean;
}

export interface DocItem {
	slug: string;
	path: string;
	title: string;
	type: "guide" | "endpoint";
}

export interface DocContent {
	content: string;
	sha: string;
	branch: string;
}

export interface ProposeResult {
	prUrl: string;
	branch: string;
	prNumber: number;
}

export interface DeployResult {
	prUrl: string;
	prNumber: number;
}

/** Browser-visible connect-api tokens. Never carries the full access token. */
export interface ConnectTokenView {
	accessTokenLite: string;
	accessTokenCrm: string | null;
	/** Epoch ms the lite token stops being accepted upstream. */
	expiresAt: number;
}

/** Error thrown when the API returns a non-2xx response, carrying the envelope code and HTTP status. */
export class ApiError extends Error {
	public code: string;
	public httpStatus: number;

	constructor(code: string, message: string, httpStatus: number) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.httpStatus = httpStatus;
	}
}

/** Reads and parses a Response body, throwing ApiError on non-2xx. */
async function parse(res: Response): Promise<unknown> {
	const text = await res.text();
	let json: unknown = {};
	if (text) {
		try {
			json = JSON.parse(text);
		} catch {
			// A body that isn't JSON is a broken response, never data — an SPA
			// fallback serving index.html, a proxy error page, a captive portal.
			// Returning it as an error-shaped OBJECT (what this used to do) let a
			// 200 sail past the `res.ok` check below and reach callers as a
			// session, which is how /console rendered an "authenticated" user
			// built from the site's own HTML.
			throw new ApiError("PARSE_ERROR", text.slice(0, 200), res.status);
		}
	}
	if (!res.ok) {
		const body = json as { error?: { code?: string; message?: string } };
		throw new ApiError(
			body.error?.code ?? "HTTP_ERROR",
			body.error?.message ?? `HTTP ${res.status}`,
			res.status,
		);
	}
	return json;
}

/** Called when a 401 survives the refresh attempt — i.e. the session is really gone. */
type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;

/**
 * Registers the single listener notified when a request 401s and the silent
 * refresh could not save it. `AuthProvider` owns it; passing `null` unregisters.
 * @param handler - The listener, or null to clear.
 */
export function setSessionExpiredHandler(
	handler: SessionExpiredHandler | null,
): void {
	onSessionExpired = handler;
}

/** In-flight `/auth/refresh`, shared by every 401 that arrives while it runs. */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Rotates the session, at most one rotation at a time.
 *
 * Refresh tokens are single-use — the backend's `rotateRefresh` does a `getdel`
 * — so N parallel 401s (a console page fires several) firing N refreshes means
 * the first consumes the token and the rest 401 on a session that was just
 * successfully renewed. Sharing one promise makes the losers await the winner's
 * answer instead of racing it into a false expiry.
 * @returns True when the session was rotated.
 */
function refreshSession(): Promise<boolean> {
	refreshInFlight ??= fetch(`${BASE}/auth/refresh`, {
		method: "POST",
		credentials: "include",
	})
		.then(async (res) => {
			// Drain the body so the connection can be reused either way.
			await res.text().catch(() => undefined);
			return res.ok;
		})
		.catch(() => false)
		.finally(() => {
			refreshInFlight = null;
		});
	return refreshInFlight;
}

/**
 * A 401 on these paths is not an expired session: OTP paths mean a bad code, and
 * a logout that 401s has already achieved what it was asked to do.
 * @param path - Request path, without the base.
 */
function isSessionSignal(path: string): boolean {
	return path !== "/auth/logout" && !path.startsWith("/auth/otp/");
}

/** Fetches a backend endpoint, auto-refreshing once on 401 (except for /auth/refresh and /auth/otp/* paths). */
async function request(
	path: string,
	init: RequestInit,
	retry = true,
): Promise<unknown> {
	const res = await fetch(`${BASE}${path}`, {
		...init,
		credentials: "include",
		headers: {
			// A FormData body must set its own content type: the boundary is part of
			// it, and naming the type here would leave the request unparseable.
			...(init.body instanceof FormData
				? {}
				: { "Content-Type": "application/json" }),
			...(init.headers ?? {}),
		},
	});
	if (res.status === 401) {
		if (
			retry &&
			path !== "/auth/refresh" &&
			!path.startsWith("/auth/otp/") &&
			(await refreshSession())
		) {
			return request(path, init, false);
		}
		// Either the refresh failed, or the replay came back 401 anyway (an admin
		// whose GitHub token died holds a perfectly valid EPS session). Both mean
		// the user cannot continue, so tell the provider once, here, rather than
		// leaving every caller to render the message on its own.
		if (isSessionSignal(path)) onSessionExpired?.();
	}
	return parse(res);
}

/** Pre-built API client with typed methods for OTP auth, session management, and user profile. */
export const authClient = {
	/** `otp` comes back only on dev/UAT backends, for testing without an SMS. */
	startOtp: (mobile: string): Promise<{ ok: true; otp?: string }> =>
		request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile }),
		}) as Promise<{ ok: true; otp?: string }>,
	verifyOtp: (mobile: string, otp: string): Promise<MeView | SignupView> =>
		request("/auth/otp/verify", {
			method: "POST",
			body: JSON.stringify({ mobile, otp }),
		}) as Promise<MeView | SignupView>,
	me: (): Promise<MeView | AdminView | SignupView> =>
		request("/me", { method: "GET" }) as Promise<
			MeView | AdminView | SignupView
		>,
	/** The caller's public IP, as the proxy saw it. Used for KYC watermarks. */
	myIp: (): Promise<{ ip: string }> =>
		request("/me/ip", { method: "GET" }) as Promise<{ ip: string }>,
	/** The signed-in developer's E-value wallet balance, in rupees. */
	walletBalance: (): Promise<WalletBalanceView> =>
		request("/wallet/balance", { method: "GET" }) as Promise<WalletBalanceView>,
	/**
	 * Reduced-scope connect-api tokens for the embedded Connect widget.
	 *
	 * The full access token is deliberately NOT part of this response — see
	 * `mountConnect` in the backend. Callers must treat this as a credential:
	 * write it where the widget reads it and nowhere else.
	 */
	connectToken: (): Promise<ConnectTokenView> =>
		request("/connect/token", { method: "GET" }) as Promise<ConnectTokenView>,
	/** The role-scoped interaction list backing `role_trxn_list`. */
	connectInteractions: (): Promise<{ interactions: unknown[] }> =>
		request("/connect/interactions", { method: "GET" }) as Promise<{
			interactions: unknown[];
		}>,
	/**
	 * Raise-issue support desk. Both calls are proxied because they need the full
	 * upstream token, and the ticket is *assembled* server-side — the browser
	 * sends answers, not a Zoho-Desk payload.
	 */
	connectSupport: {
		/** Issue types available for one transaction. */
		queryTypes: (
			body: Record<string, string>,
			signal?: AbortSignal,
		): Promise<{ issueTypes: unknown[] }> =>
			request("/connect/support/query-types", {
				method: "POST",
				body: JSON.stringify(body),
				signal,
			}) as Promise<{ issueTypes: unknown[] }>,
		/** Files the ticket. `form` carries a `payload` JSON part plus attachments. */
		ticket: (
			form: FormData,
			signal?: AbortSignal,
		): Promise<{ feedbackTicketId: string; message: string }> =>
			request("/connect/support/ticket", {
				method: "POST",
				body: form,
				signal,
			}) as Promise<{ feedbackTicketId: string; message: string }>,
	},
	/**
	 * KYC document upload. Both calls are proxied because they need the full
	 * upstream token, and the uploader's identity is added server-side — the
	 * browser says which document, never whose.
	 */
	connectKyc: {
		/** The documents this user must upload. Rows are upstream's, unparsed. */
		documents: (signal?: AbortSignal): Promise<{ documents: unknown[] }> =>
			request("/connect/kyc/documents", {
				method: "POST",
				signal,
			}) as Promise<{ documents: unknown[] }>,
		/** Uploads one document. `form` carries `doc_type`, `pages` and `file1..fileN`. */
		upload: (
			form: FormData,
			signal?: AbortSignal,
		): Promise<{ message: string }> =>
			request("/connect/kyc/upload", {
				method: "POST",
				body: form,
				signal,
			}) as Promise<{ message: string }>,
	},
	refresh: (): Promise<{ ok: true }> =>
		request("/auth/refresh", { method: "POST" }) as Promise<{ ok: true }>,
	logout: (): Promise<{ ok: true }> =>
		request("/auth/logout", { method: "POST" }) as Promise<{ ok: true }>,

	/** Admin doc management — list, read, and propose PR edits for docs content. */
	adminDocs: {
		list: (): Promise<{ docs: DocItem[] }> =>
			request("/admin/docs", { method: "GET" }) as Promise<{ docs: DocItem[] }>,
		getContent: (path: string): Promise<DocContent> =>
			request(`/admin/docs/content?path=${encodeURIComponent(path)}`, {
				method: "GET",
			}) as Promise<DocContent>,
		propose: (input: {
			path: string;
			content: string;
			baseSha: string;
			summary: string;
		}): Promise<ProposeResult> =>
			request("/admin/docs/propose", {
				method: "POST",
				body: JSON.stringify(input),
			}) as Promise<ProposeResult>,
	},

	/** Admin deploy operations — trigger production promotion PRs. */
	adminDeploy: {
		production: (): Promise<DeployResult> =>
			request("/admin/deploy/production", {
				method: "POST",
			}) as Promise<DeployResult>,
	},
};

/** Self-serve signup API — requires a signup session cookie. */
export const signupClient = {
	state: (): Promise<SignupState> =>
		request("/signup/state", { method: "GET" }) as Promise<SignupState>,
	createProfile: (): Promise<SignupState> =>
		request("/signup/profile", { method: "POST" }) as Promise<SignupState>,
	submitPan: (pan: string): Promise<SignupState> =>
		request("/signup/pan", {
			method: "POST",
			body: JSON.stringify({ pan }),
		}) as Promise<SignupState>,
	submitPin: (pin1: string, pin2: string): Promise<SignupState> =>
		request("/signup/pin", {
			method: "POST",
			body: JSON.stringify({ pin1, pin2 }),
		}) as Promise<SignupState>,
	submitBusiness: (details: Record<string, string>): Promise<SignupState> =>
		request("/signup/business", {
			method: "POST",
			body: JSON.stringify(details),
		}) as Promise<SignupState>,
	getAgreementUrl: (): Promise<SignUrlView> =>
		request("/signup/agreement/url", { method: "GET" }) as Promise<SignUrlView>,
	submitAgreement: (documentId: string): Promise<SignupState> =>
		request("/signup/agreement", {
			method: "POST",
			body: JSON.stringify({ document_id: documentId }),
		}) as Promise<SignupState>,
};

/**
 * Transaction history for the signed-in developer — requires a developer session.
 *
 * POST, not GET: the filters carry mobile numbers, account numbers, TIDs and
 * amounts, which a query string would leak into browser history and server
 * access logs.
 */
export const transactionsClient = {
	/**
	 * Fetches one page of the caller's own transactions.
	 * @param input - Paging window and allow-listed filters.
	 * @param signal - Aborts the request when the caller unmounts or re-queries.
	 * @returns The page of rows plus whether a next page should be offered.
	 */
	search: (
		input: {
			start_index: number;
			limit: number;
			filters: TransactionFilters;
		},
		signal?: AbortSignal,
	): Promise<TransactionPage> =>
		request("/transactions/search", {
			method: "POST",
			body: JSON.stringify(input),
			signal,
		}) as Promise<TransactionPage>,
};

/**
 * Business analytics for the signed-in developer — requires a developer session
 * that carries upstream Connect credentials.
 *
 * POST, not GET, for the same reason as the transaction search: this runs an
 * aggregate upstream rather than reading a cacheable resource, and the body is
 * one partner's business numbers, which must not sit in a proxy cache.
 *
 * A deployment without connect-api answers 501 `DASHBOARD_UNAVAILABLE`; callers
 * should treat that as "not on this deployment", not as a failure.
 */
export const dashboardClient = {
	/**
	 * Loads one window of the caller's own dashboard.
	 * @param input - The preset window, and an optional single-service filter.
	 * @param signal - Aborts the request when the caller unmounts or re-queries.
	 */
	load: (
		input: { preset: DatePreset; typeId?: string },
		signal?: AbortSignal,
	): Promise<DashboardView> =>
		request("/dashboard", {
			method: "POST",
			body: JSON.stringify(input),
			signal,
		}) as Promise<DashboardView>,
};
