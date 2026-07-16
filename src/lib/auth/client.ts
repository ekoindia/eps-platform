const BASE: string = import.meta.env.VITE_EPS_BACKEND_URL ?? "/api";

export type Lifecycle =
	| "lead"
	| "onboarded"
	| "active"
	| "inactive"
	| "unknown";

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
			json = { error: { code: "PARSE_ERROR", message: text.slice(0, 200) } };
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

/** Fetches a backend endpoint, auto-refreshing once on 401 (except for /auth/refresh and /auth/otp/* paths). */
async function request(
	path: string,
	init: RequestInit,
	retry = true,
): Promise<unknown> {
	const res = await fetch(`${BASE}${path}`, {
		...init,
		credentials: "include",
		headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
	});
	if (
		res.status === 401 &&
		retry &&
		path !== "/auth/refresh" &&
		!path.startsWith("/auth/otp/")
	) {
		const refreshed = await fetch(`${BASE}/auth/refresh`, {
			method: "POST",
			credentials: "include",
		});
		if (refreshed.ok) return request(path, init, false);
		await refreshed.text().catch(() => undefined);
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
};
