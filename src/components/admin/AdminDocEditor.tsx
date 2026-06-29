import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { authClient, ApiError, type ProposeResult } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const STALE_HINT = "This doc changed upstream — reload before saving.";

/** Loads one doc, edits it in CodeMirror, and proposes the change as a PR into dev. */
export function AdminDocEditor({ path }: { path: string }) {
	const [content, setContent] = useState<string>("");
	const [baseSha, setBaseSha] = useState<string | null>(null);
	const [summary, setSummary] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(true);
	const [busy, setBusy] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ProposeResult | null>(null);
	// The last content known to match upstream; drives the unsaved-changes badge.
	const originalRef = useRef<string>("");
	const isDirty = content !== originalRef.current;

	/** Fetches the doc and resets editor state; reused by initial load and reload. */
	const load = useCallback(() => {
		let active = true;
		setLoading(true);
		setError(null);
		setResult(null);
		authClient.adminDocs
			.getContent(path)
			.then((doc) => {
				if (!active) return;
				setContent(doc.content);
				originalRef.current = doc.content;
				setBaseSha(doc.sha);
			})
			.catch(() => active && setError("Could not load this doc."))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, [path]);

	useEffect(() => load(), [load]);

	async function propose() {
		if (baseSha === null) return;
		setBusy(true);
		setError(null);
		try {
			const r = await authClient.adminDocs.propose({
				path,
				content,
				baseSha,
				summary,
			});
			setResult(r);
			originalRef.current = content;
		} catch (e) {
			const code = e instanceof ApiError ? e.code : "";
			setError(
				code === "STALE_CONTENT"
					? STALE_HINT
					: e instanceof ApiError
						? e.message
						: "Could not propose the change.",
			);
		} finally {
			setBusy(false);
		}
	}

	if (loading)
		return (
			<div className="flex flex-col gap-3" aria-busy="true">
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-[60vh] w-full" />
				<Skeleton className="h-9 w-full" />
			</div>
		);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<p className="truncate text-xs text-muted-foreground">{path}</p>
				{isDirty && (
					<Badge variant="outline" className="border-amber-300 text-amber-600">
						Unsaved changes
					</Badge>
				)}
			</div>
			<CodeMirror
				value={content}
				height="60vh"
				extensions={[markdown()]}
				onChange={setContent}
			/>
			<div className="flex flex-col gap-1">
				<Label htmlFor="summary">Change summary</Label>
				<Input
					id="summary"
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
					placeholder="What changed and why"
				/>
				<p className="text-xs text-muted-foreground">
					Becomes the pull request title. Be concise and specific.
				</p>
			</div>
			<div>
				<Button onClick={propose} disabled={busy || baseSha === null}>
					{busy ? "Proposing…" : "Propose changes"}
				</Button>
			</div>
			{result && (
				<div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
					<span aria-hidden>✓</span>
					<span>Pull request #{result.prNumber} opened.</span>
					<Button variant="outline" size="sm" asChild>
						<a href={result.prUrl} target="_blank" rel="noreferrer">
							View PR #{result.prNumber}
						</a>
					</Button>
				</div>
			)}
			{error && (
				<div className="flex items-center gap-3">
					<p className="text-sm text-destructive">{error}</p>
					{error === STALE_HINT && (
						<Button variant="outline" size="sm" onClick={load}>
							Reload doc
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
