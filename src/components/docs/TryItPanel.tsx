import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SIGNUP_PAGE } from "@/lib/config/site";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import { buildSignedHeaders } from "@/lib/docs/eko-signing";
import { resolveEndpointUrl } from "@/lib/docs/code-samples";

const CREDS_KEY = "eko-docs-uat-creds";

interface Creds {
	developerKey: string;
	accessKey: string;
}

interface Result {
	ok: boolean;
	status?: number;
	body?: string;
	error?: string;
}

/** Financial endpoints can only be sent live once their signing order is known. */
const canSend = (spec: ApiSpec): boolean =>
	!spec.financial || Boolean(spec.requestHashParams?.length);

/**
 * In-browser "Try it" console. The user supplies UAT credentials; we sign the
 * request locally with Web Crypto at send time and call the sandbox directly —
 * no backend. Credentials never leave the browser except as the computed
 * signature. Client-only behaviour lives in handlers; the form markup renders
 * fine during SSR.
 */
export const TryItPanel = ({ spec }: { spec: ApiSpec }) => {
	const [creds, setCreds] = useState<Creds>({
		developerKey: "",
		accessKey: "",
	});
	const [bodyText, setBodyText] = useState(() =>
		JSON.stringify(spec.sampleRequest, null, 2),
	);
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<Result | null>(null);

	// Prefill from localStorage, then DEV-only env (never bundled in prod).
	useEffect(() => {
		try {
			const saved = localStorage.getItem(CREDS_KEY);
			if (saved) {
				setCreds(JSON.parse(saved));
				return;
			}
		} catch {
			/* ignore */
		}
		if (import.meta.env.DEV) {
			const dev = {
				developerKey: import.meta.env.VITE_EKO_DEVELOPER_KEY ?? "",
				accessKey: import.meta.env.VITE_EKO_ACCESS_KEY ?? "",
			};
			if (dev.developerKey || dev.accessKey) setCreds(dev);
		}
	}, []);

	const updateCred = (k: keyof Creds, v: string) => {
		const next = { ...creds, [k]: v };
		setCreds(next);
		try {
			localStorage.setItem(CREDS_KEY, JSON.stringify(next));
		} catch {
			/* ignore */
		}
	};

	const hasCreds = creds.developerKey.trim() && creds.accessKey.trim();
	const sendable = canSend(spec);

	const send = async () => {
		setResult(null);
		let body: Record<string, unknown>;
		try {
			body = JSON.parse(bodyText) as Record<string, unknown>;
		} catch {
			setResult({ ok: false, error: "Request body is not valid JSON." });
			return;
		}

		setSending(true);
		try {
			const headers = await buildSignedHeaders(spec, creds, body, Date.now());
			const url = resolveEndpointUrl(spec, body);
			const res = await fetch(url, {
				method: spec.method,
				headers: headers as unknown as Record<string, string>,
				body: spec.method === "GET" ? undefined : JSON.stringify(body),
			});
			const text = await res.text();
			let pretty = text;
			try {
				pretty = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				/* leave as-is */
			}
			setResult({ ok: res.ok, status: res.status, body: pretty });
		} catch (err) {
			setResult({
				ok: false,
				error: `${(err as Error).message}. The sandbox may block direct browser requests (CORS) — if so, copy the cURL sample and run it from your terminal.`,
			});
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="space-y-4">
			{!hasCreds && (
				<div className="rounded-lg border border-eko-gold/40 bg-eko-gold-light px-3 py-2.5 text-sm text-eko-navy dark:bg-eko-gold/10 dark:text-foreground">
					Enter your UAT credentials to send a live sandbox request.{" "}
					<a
						href={SIGNUP_PAGE}
						className="font-medium underline underline-offset-2"
					>
						Sign up for UAT credentials
					</a>{" "}
					to use in the sandbox.
				</div>
			)}

			<div className="grid gap-3 sm:grid-cols-2">
				<label className="space-y-1">
					<span className="text-xs font-medium text-muted-foreground">
						developer_key
					</span>
					<Input
						value={creds.developerKey}
						onChange={(e) => updateCred("developerKey", e.target.value)}
						placeholder="your UAT developer key"
						autoComplete="off"
					/>
				</label>
				<label className="space-y-1">
					<span className="text-xs font-medium text-muted-foreground">
						access_key
					</span>
					<Input
						type="password"
						value={creds.accessKey}
						onChange={(e) => updateCred("accessKey", e.target.value)}
						placeholder="your UAT access key"
						autoComplete="off"
					/>
				</label>
			</div>
			<p className="text-xs text-muted-foreground">
				Signed locally in your browser; never sent anywhere except the sandbox.
			</p>

			{spec.method !== "GET" && (
				<label className="block space-y-1">
					<span className="text-xs font-medium text-muted-foreground">
						Request body (JSON)
					</span>
					<textarea
						value={bodyText}
						onChange={(e) => setBodyText(e.target.value)}
						spellCheck={false}
						rows={10}
						className="docs-scroll w-full rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
			)}

			{!sendable ? (
				<p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
					Live send is disabled for this money-debit API until its{" "}
					<code className="font-mono">request_hash</code> parameter order is
					configured. Use the code samples with your own signing instead.
				</p>
			) : (
				<Button
					variant="gold"
					onClick={send}
					disabled={!hasCreds || sending}
					className="w-full gap-2"
				>
					{sending && <Loader2 className="h-4 w-4 animate-spin" />}
					{sending ? "Sending…" : "Send request"}
				</Button>
			)}

			{result && (
				<div className="space-y-1">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{result.error
							? "Error"
							: `Response${result.status ? ` · ${result.status}` : ""}`}
					</p>
					<pre className="code-block docs-scroll max-h-80 overflow-auto rounded-xl p-4 text-xs leading-relaxed">
						<code>{result.error ?? result.body}</code>
					</pre>
				</div>
			)}
		</div>
	);
};
