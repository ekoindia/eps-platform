import { useState } from "react";
import { authClient, ApiError, type DeployResult } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

/** Two-step confirm action that opens a dev → main release PR. */
export function DeployToProduction() {
	const [confirming, setConfirming] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);
	const [result, setResult] = useState<DeployResult | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	async function deploy() {
		setBusy(true);
		setMessage(null);
		setResult(null);
		try {
			setResult(await authClient.adminDeploy.production());
		} catch (e) {
			setMessage(
				e instanceof ApiError ? e.message : "Could not start a deploy.",
			);
		} finally {
			setBusy(false);
			setConfirming(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			{!confirming ? (
				<Button variant="outline" onClick={() => setConfirming(true)}>
					Deploy to production
				</Button>
			) : (
				<>
					<span className="text-sm text-muted-foreground">
						Open a dev → main release PR?
					</span>
					<Button onClick={deploy} disabled={busy}>
						{busy ? "Opening…" : "Confirm"}
					</Button>
					<Button
						variant="ghost"
						onClick={() => setConfirming(false)}
						disabled={busy}
					>
						Cancel
					</Button>
				</>
			)}
			{result && (
				<a
					className="text-sm underline"
					href={result.prUrl}
					target="_blank"
					rel="noreferrer"
				>
					Release PR #{result.prNumber}
				</a>
			)}
			{message && (
				<span className="text-sm text-muted-foreground">{message}</span>
			)}
		</div>
	);
}
