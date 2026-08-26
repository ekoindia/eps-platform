import { Check, Copy, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOptionalConnectDialogs } from "@/components/connect/DialogHost";
import { useOptionalAuth } from "@/lib/auth/AuthProvider";
import {
	diagnosticsBlob,
	diagnosticsLine,
	errorDiagnostics,
} from "@/lib/console/diagnostics";
import { canRaiseIssue } from "@/lib/console/lifecycle";
import { cn } from "@/lib/utils";

interface ErrorNoticeProps {
	/** Whatever the catch block caught. Pass the object, never `err.message`. */
	error: unknown;
	/** Shown instead of the error's own message when it has none worth reading. */
	fallback?: string;
	/**
	 * `alert` is the red box a real failure gets. `note` is the muted dashed box
	 * for a configuration fact — a deployment without connect-api is not a fault
	 * and must not read like one.
	 */
	variant?: "alert" | "note";
	className?: string;
}

/** Copies `text`, reporting success rather than failing silently. */
async function copy(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Clipboard is permission-gated and absent over plain http.
		return false;
	}
}

/**
 * The console's single error surface.
 *
 * Replaces four byte-identical red boxes that each rendered a bare string, and
 * in doing so threw away everything needed to act on the failure: three of them
 * flattened the error to `err.message` at the catch, so `code`, `details` and
 * the request id never reached the screen.
 *
 * What it adds is a screenshot that is worth receiving — the message, then one
 * mono line naming who failed, the upstream reference, the account and the
 * request id — plus a copy button for the full JSON and a route into the
 * existing Raise Issue dialog with all of it attached.
 */
export function ErrorNotice({
	error,
	fallback = "Something went wrong.",
	variant = "alert",
	className,
}: ErrorNoticeProps) {
	const [copied, setCopied] = useState(false);
	const dialogs = useOptionalConnectDialogs();
	// Optional on purpose: this notice also renders from the error boundary and
	// the site header, outside any provider.
	const auth = useOptionalAuth();
	const accountStateId =
		auth?.state.status === "authed" && auth.state.role === "developer"
			? auth.state.me.profile?.accountStateId
			: null;
	const ticketable = canRaiseIssue(accountStateId);
	const diagnostics = errorDiagnostics(error);
	const line = diagnosticsLine(diagnostics);

	if (variant === "note") {
		return (
			<div
				className={cn(
					"rounded-md border border-dashed p-6 text-sm text-muted-foreground",
					className,
				)}
			>
				{diagnostics.safeMessage ?? fallback}
			</div>
		);
	}

	/** Field-level upstream diagnostics, when upstream named the fields. */
	const invalidParams = diagnostics.details?.invalid_params as
		| Record<string, unknown>
		| undefined;

	return (
		<div
			role="alert"
			className={cn(
				"rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive",
				className,
			)}
		>
			<p>{diagnostics.safeMessage ?? fallback}</p>

			{/* Upstream said WHICH field it rejected; without this the message
			    "Please provide the value of the field" names nothing. */}
			{invalidParams ? (
				<ul className="mt-2 list-disc pl-5 text-xs">
					{Object.entries(invalidParams).map(([field, why]) => (
						<li key={field}>
							<span className="font-medium">{field}</span>: {String(why)}
						</li>
					))}
				</ul>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
				{/* Selectable so it can be read off a screenshot OR copied as text. */}
				<code className="select-all font-mono text-xs opacity-70">{line}</code>

				<button
					type="button"
					className="inline-flex cursor-pointer items-center gap-1 text-xs underline underline-offset-2 hover:opacity-80"
					onClick={async () => {
						if (!(await copy(diagnosticsBlob(diagnostics)))) {
							toast.error("Couldn't copy — select the text instead.");
							return;
						}
						setCopied(true);
						toast.success("Diagnostics copied");
						window.setTimeout(() => setCopied(false), 1500);
					}}
				>
					{copied ? (
						<Check className="h-3 w-3" />
					) : (
						<Copy className="h-3 w-3" />
					)}
					Copy diagnostics
				</button>

				{/* Two conditions, for two different reasons: a dialog host has to
				    exist (the site header and the error boundary render outside one),
				    and the account has to be one Zoho can actually file a ticket
				    against — see `canRaiseIssue`. */}
				{dialogs && ticketable ? (
					<button
						type="button"
						className="inline-flex cursor-pointer items-center gap-1 text-xs underline underline-offset-2 hover:opacity-80"
						onClick={() => {
							void dialogs.showRaiseIssue({
								origin: "Global-Help",
								metadata: {
									// A typed interface, widened at the boundary: the dialog
									// only carries this through to the ticket.
									diagnostics: { ...diagnostics },
								},
							});
						}}
					>
						<LifeBuoy className="h-3 w-3" />
						Raise issue
					</button>
				) : null}
			</div>
		</div>
	);
}
