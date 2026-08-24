import { Component, type ErrorInfo, type ReactNode } from "react";
import { CopyDiagnosticsButton } from "@/components/CopyDiagnosticsButton";
import {
	isChunkLoadError,
	reloadOnceForStaleChunk,
} from "@/lib/reload-on-chunk-error";

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
	componentStack: string | null;
}

/**
 * Catches render-phase errors below it (including failed `React.lazy`
 * chunk loads after a redeploy). Stale-chunk failures trigger a guarded
 * page reload via reloadOnceForStaleChunk; anything else renders a
 * minimal recovery UI instead of the blank page React leaves behind
 * when no boundary exists.
 *
 * The failure itself is shown in a collapsed `<details>`, mirroring Eloka's
 * boundary: "Something went wrong" alone is unactionable for the user and
 * unreportable for support, and the message is usually the whole diagnosis.
 */


export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { error: null, componentStack: null };

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		if (isChunkLoadError(error) && reloadOnceForStaleChunk()) return;
		console.error("Unhandled render error:", error, errorInfo.componentStack);
		this.setState({ componentStack: errorInfo.componentStack ?? null });
	}

	render(): ReactNode {
		const { error, componentStack } = this.state;
		if (error) {
			return (
				<div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
					<h1 className="text-2xl font-semibold">Something went wrong</h1>
					<p className="text-muted-foreground">
						Please reload the page to continue.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Reload page
						</button>
						{/* Re-renders the subtree without a full reload — enough when the
						    failure was transient, and it keeps any unsaved page state. */}
						<button
							type="button"
							onClick={() =>
								this.setState({ error: null, componentStack: null })
							}
							className="rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
						>
							Try again
						</button>
					</div>

					<details className="mt-2 w-full rounded-md border bg-muted/40 p-2 text-left">
						<summary className="cursor-pointer py-1 text-sm font-medium">
							Error details
						</summary>
						{/* A render crash is the failure a user is least able to describe
						    and least likely to reproduce, so the whole point is getting it
						    off their screen in one click. The component stack goes along
						    with it — it is the part that actually names the broken code. */}
						<CopyDiagnosticsButton error={error} componentStack={componentStack} />
						<div className="max-h-72 overflow-auto p-2">
							<pre className="whitespace-pre-wrap break-words text-xs">
								{String(error)}
							</pre>
							{componentStack && (
								<>
									<p className="mt-3 text-xs font-semibold">Trace</p>
									<pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
										{componentStack}
									</pre>
								</>
							)}
						</div>
					</details>
				</div>
			);
		}
		return this.props.children;
	}
}
