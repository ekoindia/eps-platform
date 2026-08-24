import { useState } from "react";
import { toast } from "sonner";
import { diagnosticsBlob, errorDiagnostics } from "@/lib/console/diagnostics";

/**
 * Copies a failure's diagnostics to the clipboard, optionally including a React
 * component stack.
 *
 * Lives beside `ErrorBoundary` rather than inside it because the boundary is a
 * class and this needs the `copied` state a hook gives. A render crash is the
 * failure a user is least able to describe and least likely to reproduce, so
 * getting the whole thing off their screen in one click is the entire point.
 */
export function CopyDiagnosticsButton({
	error,
	componentStack,
	className,
}: {
	error: unknown;
	componentStack?: string | null;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className={
				className ??
				"mb-1 inline-flex cursor-pointer items-center gap-1 text-xs underline underline-offset-2 hover:opacity-80"
			}
			onClick={async () => {
				const blob = diagnosticsBlob({
					...errorDiagnostics(error),
					...(componentStack ? { componentStack } : {}),
				});
				try {
					await navigator.clipboard.writeText(blob);
					setCopied(true);
					toast.success("Diagnostics copied");
					window.setTimeout(() => setCopied(false), 1500);
				} catch {
					// Clipboard is permission-gated and absent over plain http; the raw
					// text is still on screen below, so say so rather than fail silently.
					toast.error("Couldn't copy — select the text below instead.");
				}
			}}
		>
			{copied ? "Copied" : "Copy diagnostics"}
		</button>
	);
}
