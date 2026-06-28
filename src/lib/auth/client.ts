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

async function parse(res: Response): Promise<unknown> {
	const text = await res.text();
	const json: unknown = text ? JSON.parse(text) : {};
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
	if (res.status === 401 && retry && path !== "/auth/refresh") {
		const refreshed = await fetch(`${BASE}/auth/refresh`, {
			method: "POST",
			credentials: "include",
		});
		if (refreshed.ok) return request(path, init, false);
	}
	return parse(res);
}

export const authClient = {
	startOtp: (mobile: string): Promise<{ ok: true }> =>
		request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile }),
		}) as Promise<{ ok: true }>,
	verifyOtp: (mobile: string, otp: string): Promise<MeView> =>
		request("/auth/otp/verify", {
			method: "POST",
			body: JSON.stringify({ mobile, otp }),
		}) as Promise<MeView>,
	me: (): Promise<MeView | AdminView> =>
		request("/me", { method: "GET" }) as Promise<MeView | AdminView>,
	refresh: (): Promise<{ ok: true }> =>
		request("/auth/refresh", { method: "POST" }) as Promise<{ ok: true }>,
	logout: (): Promise<{ ok: true }> =>
		request("/auth/logout", { method: "POST" }) as Promise<{ ok: true }>,
};
