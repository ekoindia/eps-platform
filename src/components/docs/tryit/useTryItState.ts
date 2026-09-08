/**
 * State + send pipeline for the Try-it dialog. One reducer owns the form; the
 * pure steps live in `lib/docs/tryit-request.ts`.
 *
 * Persistence: the last request per API survives modal close / reload within
 * the tab (sessionStorage, keyed by spec id). Credentials, uploads, results and
 * the raw-JSON draft are never written; credential-named body keys are
 * redacted so a pasted key cannot leak into storage either.
 */
import type { ApiSpec, ResolvedApiParam } from "@/lib/data/api-specs-common";
import {
	buildSampleRequest,
	multipartPayloadFrom,
	splitMultipartBody,
} from "@/lib/data/api-specs-common";
import {
	abortKind,
	buildTryItRequest,
	editableParams,
	generateClientRefId,
	isPlainObject,
	redactCredentialKeys,
	sendViaProxy,
	TRYIT_TIMEOUT_MS,
	type TryItCreds,
	type TryItEnv,
	type TryItResult,
	TryItProxyError,
	validateParams,
} from "@/lib/docs/tryit-request";
import { uatCredentials } from "@/lib/uat-credentials";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

export interface TryItState {
	env: TryItEnv;
	/** In-memory only. */
	creds: TryItCreds;
	/** Path + query values (wire strings). */
	params: Record<string, string>;
	/** Authoritative non-file body (typed values). */
	body: Record<string, unknown>;
	/** Uploads; never persisted. */
	files: Record<string, File | null>;
	/** Raw editor text while it differs from `body` (kept across keystrokes so
	 * the cursor never jumps); null = mirrors `body`. */
	rawDraft: string | null;
	rawMode: boolean;
	rawError: string | null;
	/** Regenerate `client_ref_id` on every send. */
	autoRef: boolean;
	fieldErrors: Record<string, string>;
	/** Production + financial: first Send arms, second confirms. */
	armed: boolean;
	status: "idle" | "sending" | "done";
	result: TryItResult | null;
	error: string | null;
	/** The `client_ref_id` actually sent last — shown when the outcome is unknown. */
	lastSentRef: string | null;
	/** Set when a financial send was dispatched but no answer came back. */
	outcomeUnknown: boolean;
}

type Action =
	| { type: "setEnv"; env: TryItEnv }
	| { type: "setCreds"; creds: Partial<TryItCreds> }
	| { type: "setParam"; name: string; value: string }
	| { type: "setBodyField"; name: string; value: unknown }
	| { type: "setFieldError"; name: string; error: string | null }
	| { type: "setFile"; name: string; file: File | null }
	| { type: "setRaw"; text: string }
	| { type: "setRawMode"; rawMode: boolean }
	| { type: "setAutoRef"; autoRef: boolean }
	| { type: "arm" }
	| {
			type: "sendStart";
			body: Record<string, unknown>;
			params: Record<string, string>;
			ref: string | null;
	  }
	| { type: "sendDone"; result: TryItResult }
	| {
			type: "sendFail";
			error: string;
			fieldErrors?: Record<string, string>;
			outcomeUnknown?: boolean;
	  }
	| { type: "reset"; state: TryItState };

const EMPTY_CREDS: TryItCreds = { developerKey: "", accessKey: "" };

const credsFor = (env: TryItEnv): TryItCreds =>
	env === "sandbox" ? (uatCredentials() ?? EMPTY_CREDS) : EMPTY_CREDS;

const storageKey = (spec: ApiSpec): string => `eko-tryit:${spec.id}`;

type Persisted = Pick<
	TryItState,
	"env" | "params" | "body" | "rawMode" | "autoRef"
>;

const readPersisted = (spec: ApiSpec): Partial<Persisted> => {
	try {
		const raw = sessionStorage.getItem(storageKey(spec));
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!isPlainObject(parsed)) return {};
		const out: Partial<Persisted> = {};
		if (parsed.env === "sandbox" || parsed.env === "production")
			out.env = parsed.env;
		if (isPlainObject(parsed.params))
			out.params = Object.fromEntries(
				Object.entries(parsed.params).map(([k, v]) => [k, String(v)]),
			);
		if (isPlainObject(parsed.body)) out.body = parsed.body;
		if (typeof parsed.rawMode === "boolean") out.rawMode = parsed.rawMode;
		if (typeof parsed.autoRef === "boolean") out.autoRef = parsed.autoRef;
		return out;
	} catch {
		return {};
	}
};

/** Spec defaults (examples), no storage. */
const defaultState = (
	spec: ApiSpec,
	params: ResolvedApiParam[],
): TryItState => {
	const fileNames = splitMultipartBody(params).files.map((f) => f.name);
	const urlParams: Record<string, string> = {};
	for (const p of params) {
		if (p.in === "path" || p.in === "query")
			urlParams[p.name] = p.example == null ? "" : String(p.example);
	}
	return {
		env: "sandbox",
		creds: credsFor("sandbox"),
		params: urlParams,
		body: multipartPayloadFrom(buildSampleRequest(spec), fileNames),
		files: Object.fromEntries(fileNames.map((n) => [n, null])),
		rawDraft: null,
		rawMode: false,
		rawError: null,
		autoRef: true,
		fieldErrors: {},
		armed: false,
		status: "idle",
		result: null,
		error: null,
		lastSentRef: null,
		outcomeUnknown: false,
	};
};

/** Defaults overlaid with the persisted request; creds derive from the FINAL
 * env so a restored production session never inherits the UAT keypair. */
const initialState = (
	spec: ApiSpec,
	params: ResolvedApiParam[],
): TryItState => {
	const base = defaultState(spec, params);
	const saved =
		typeof sessionStorage === "undefined" ? {} : readPersisted(spec);
	const env = saved.env ?? base.env;
	return {
		...base,
		...saved,
		env,
		creds: credsFor(env),
	};
};

const disarm = (s: TryItState): TryItState =>
	s.armed ? { ...s, armed: false } : s;

const reducer = (state: TryItState, action: Action): TryItState => {
	switch (action.type) {
		case "setEnv":
			if (action.env === state.env) return state;
			return {
				...state,
				env: action.env,
				creds: credsFor(action.env),
				result: null,
				error: null,
				armed: false,
				outcomeUnknown: false,
			};
		case "setCreds":
			return disarm({ ...state, creds: { ...state.creds, ...action.creds } });
		case "setParam":
			return disarm({
				...state,
				params: { ...state.params, [action.name]: action.value },
				fieldErrors: omit(state.fieldErrors, action.name),
			});
		case "setBodyField": {
			const body = { ...state.body };
			if (action.value === undefined) delete body[action.name];
			else body[action.name] = action.value;
			return disarm({
				...state,
				body,
				rawDraft: null,
				rawError: null,
				fieldErrors: omit(state.fieldErrors, action.name),
			});
		}
		case "setFieldError":
			return {
				...state,
				fieldErrors: action.error
					? { ...state.fieldErrors, [action.name]: action.error }
					: omit(state.fieldErrors, action.name),
			};
		case "setFile":
			return disarm({
				...state,
				files: { ...state.files, [action.name]: action.file },
				fieldErrors: omit(state.fieldErrors, action.name),
			});
		case "setRaw": {
			try {
				const parsed: unknown = JSON.parse(action.text);
				if (!isPlainObject(parsed))
					throw new Error("Body must be a JSON object");
				return disarm({
					...state,
					body: parsed,
					rawDraft: action.text,
					rawError: null,
					fieldErrors: {},
				});
			} catch (e) {
				return disarm({
					...state,
					rawDraft: action.text,
					rawError: e instanceof Error ? e.message : "Invalid JSON",
				});
			}
		}
		case "setRawMode":
			// Leaving Raw re-mirrors the body; an invalid draft is dropped on purpose
			// (the form shows the last valid body, and Send was blocked meanwhile).
			return {
				...state,
				rawMode: action.rawMode,
				...(action.rawMode ? {} : { rawDraft: null, rawError: null }),
			};
		case "setAutoRef":
			return disarm({ ...state, autoRef: action.autoRef });
		case "arm":
			return { ...state, armed: true };
		case "sendStart":
			return {
				...state,
				body: action.body,
				params: action.params,
				rawDraft: null,
				rawError: null,
				fieldErrors: {},
				armed: false,
				status: "sending",
				error: null,
				lastSentRef: action.ref ?? state.lastSentRef,
				outcomeUnknown: false,
			};
		case "sendDone":
			return { ...state, status: "done", result: action.result, error: null };
		case "sendFail":
			return {
				...state,
				status: state.result ? "done" : "idle",
				error: action.error,
				fieldErrors: action.fieldErrors ?? state.fieldErrors,
				outcomeUnknown: action.outcomeUnknown ?? false,
			};
		case "reset":
			return action.state;
	}
};

const omit = (
	obj: Record<string, string>,
	key: string,
): Record<string, string> => {
	if (!(key in obj)) return obj;
	const { [key]: _dropped, ...rest } = obj;
	return rest;
};

export interface TryItController {
	state: TryItState;
	dispatch: (action: Action) => void;
	params: ResolvedApiParam[];
	/** Whether `spec` takes a `client_ref_id` the widget can regenerate. */
	hasClientRef: boolean;
	send: () => Promise<void>;
	abort: () => void;
	clearSaved: () => void;
}

/**
 * Owns the Try-it form for one spec and runs the send pipeline.
 * @param spec - the endpoint being tried.
 * @param open - whether the dialog is open (closing aborts any in-flight send).
 */
export const useTryItState = (
	spec: ApiSpec,
	open: boolean,
): TryItController => {
	const params = useMemo(() => editableParams(spec), [spec]);
	const [state, dispatch] = useReducer(reducer, undefined, () =>
		initialState(spec, params),
	);
	const inFlight = useRef<AbortController | null>(null);
	const sendId = useRef(0);
	const stateRef = useRef(state);
	useEffect(() => {
		stateRef.current = state;
	});

	const refParam = params.find((p) => p.name === "client_ref_id");
	const hasClientRef = refParam !== undefined;

	// Persist the request shape (never creds / files / results / raw draft).
	useEffect(() => {
		try {
			const persisted: Persisted = {
				env: state.env,
				params: state.params,
				body: redactCredentialKeys(state.body),
				rawMode: state.rawMode,
				autoRef: state.autoRef,
			};
			sessionStorage.setItem(storageKey(spec), JSON.stringify(persisted));
		} catch {
			/* ignore */
		}
	}, [spec, state.env, state.params, state.body, state.rawMode, state.autoRef]);

	const abort = useCallback(() => {
		inFlight.current?.abort();
		inFlight.current = null;
	}, []);

	// Closing the dialog (or unmounting) cancels whatever is in flight.
	useEffect(() => {
		if (!open) abort();
		return abort;
	}, [open, abort]);

	const send = useCallback(async () => {
		const s = stateRef.current;
		if (inFlight.current) return;
		if (s.rawError) {
			dispatch({
				type: "sendFail",
				error: `Fix the JSON body first: ${s.rawError}`,
			});
			return;
		}
		if (
			s.env === "production" &&
			(!s.creds.developerKey || !s.creds.accessKey)
		) {
			dispatch({
				type: "sendFail",
				error: "Enter your production developer_key and access_key.",
			});
			return;
		}
		if (s.env === "production" && spec.financial && !s.armed) {
			dispatch({ type: "arm" });
			return;
		}
		// Immutable snapshot of what goes on the wire.
		const body = { ...s.body };
		const urlParams = { ...s.params };
		let ref: string | null = null;
		if (s.autoRef && refParam) {
			ref = generateClientRefId(Date.now());
			if (refParam.in === "body") body.client_ref_id = ref;
			else urlParams.client_ref_id = ref;
		} else if (refParam) {
			const current =
				refParam.in === "body" ? body.client_ref_id : urlParams.client_ref_id;
			ref = current == null ? null : String(current);
		}
		dispatch({ type: "sendStart", body, params: urlParams, ref });

		const fieldErrors = validateParams(params, {
			params: urlParams,
			body,
			files: s.files,
		});
		if (Object.keys(fieldErrors).length) {
			dispatch({
				type: "sendFail",
				error: "Fix the highlighted fields.",
				fieldErrors,
			});
			return;
		}

		const controller = new AbortController();
		inFlight.current = controller;
		const id = ++sendId.current;
		const timer = setTimeout(
			() => controller.abort(new DOMException("Timed out", "TimeoutError")),
			TRYIT_TIMEOUT_MS,
		);
		let dispatched = false;
		try {
			const request = await buildTryItRequest(spec, {
				env: s.env,
				params: urlParams,
				body,
				files: s.files,
				creds: s.creds,
				now: Date.now(),
			});
			dispatched = true;
			const result = await sendViaProxy(request, controller.signal);
			if (id === sendId.current) dispatch({ type: "sendDone", result });
		} catch (e) {
			if (id !== sendId.current) return;
			const unknown = dispatched && Boolean(spec.financial);
			if (controller.signal.aborted) {
				const kind = abortKind(controller.signal.reason);
				dispatch({
					type: "sendFail",
					error:
						kind === "timeout" ? "Request timed out." : "Request cancelled.",
					outcomeUnknown: unknown,
				});
			} else if (e instanceof TryItProxyError) {
				dispatch({
					type: "sendFail",
					error: e.message,
					outcomeUnknown: unknown,
				});
			} else {
				dispatch({
					type: "sendFail",
					error: e instanceof Error ? e.message : "Request failed.",
					outcomeUnknown: unknown,
				});
			}
		} finally {
			clearTimeout(timer);
			if (inFlight.current === controller) inFlight.current = null;
		}
	}, [spec, params, refParam]);

	const clearSaved = useCallback(() => {
		try {
			sessionStorage.removeItem(storageKey(spec));
		} catch {
			/* ignore */
		}
		dispatch({ type: "reset", state: defaultState(spec, params) });
	}, [spec, params]);

	return { state, dispatch, params, hasClientRef, send, abort, clearSaved };
};
