import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { authClient, ApiError, type ProposeResult } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Loads one doc, edits it in CodeMirror, and proposes the change as a PR into dev. */
export function AdminDocEditor({ path }: { path: string }) {
	const [content, setContent] = useState<string>("");
	const [baseSha, setBaseSha] = useState<string | null>(null);
	const [summary, setSummary] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(true);
	const [busy, setBusy] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ProposeResult | null>(null);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(null);
		setResult(null);
		authClient.adminDocs
			.getContent(path)
			.then((doc) => {
				if (!active) return;
				setContent(doc.content);
				setBaseSha(doc.sha);
			})
			.catch(() => active && setError("Could not load this doc."))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, [path]);

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
		} catch (e) {
			const code = e instanceof ApiError ? e.code : "";
			setError(
				code === "STALE_CONTENT"
					? "This doc changed upstream — reload before saving."
					: e instanceof ApiError
						? e.message
						: "Could not propose the change.",
			);
		} finally {
			setBusy(false);
		}
	}

	if (loading)
		return <p className="text-sm text-muted-foreground">Loading {path}…</p>;

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">{path}</p>
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
			</div>
			<div className="flex items-center gap-3">
				<Button onClick={propose} disabled={busy || baseSha === null}>
					{busy ? "Proposing…" : "Propose changes"}
				</Button>
				{result && (
					<a
						className="text-sm underline"
						href={result.prUrl}
						target="_blank"
						rel="noreferrer"
					>
						View PR #{result.prNumber}
					</a>
				)}
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
