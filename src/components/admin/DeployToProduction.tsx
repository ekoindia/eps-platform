import { useState } from "react";
import { authClient, ApiError, type DeployResult } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

/** Opens a dev → main release PR, behind a confirmation dialog matching the action's weight. */
export function DeployToProduction() {
	const [open, setOpen] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);
	const [result, setResult] = useState<DeployResult | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	async function deploy() {
		setBusy(true);
		setMessage(null);
		setResult(null);
		try {
			setResult(await authClient.adminDeploy.production());
			setOpen(false);
		} catch (e) {
			setMessage(
				e instanceof ApiError ? e.message : "Could not start a deploy.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					<Button
						variant="outline"
						className="border-destructive/40 text-destructive hover:bg-destructive/5"
					>
						Deploy to production
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Deploy to production</DialogTitle>
						<DialogDescription>
							This opens a release pull request from <strong>dev</strong> →{" "}
							<strong>main</strong>. The site goes live when that PR is merged.
						</DialogDescription>
					</DialogHeader>
					{message && <p className="text-sm text-destructive">{message}</p>}
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setOpen(false)}
							disabled={busy}
						>
							Cancel
						</Button>
						<Button onClick={deploy} disabled={busy}>
							{busy ? "Opening…" : "Open release PR"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{result && (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
					<span aria-hidden>✓</span>
					<span>Release PR #{result.prNumber} opened.</span>
					<a
						className="underline"
						href={result.prUrl}
						target="_blank"
						rel="noreferrer"
					>
						View release PR #{result.prNumber}
					</a>
					<button
						type="button"
						aria-label="Dismiss"
						className="ml-1 text-green-700/70 hover:text-green-900"
						onClick={() => setResult(null)}
					>
						×
					</button>
				</div>
			)}
		</div>
	);
}
