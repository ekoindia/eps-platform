import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { API_PRODUCTS_MAP } from "@/lib/data/api-products";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import { resolveEndpointUrl } from "@/lib/docs/code-samples";
import type { TryItEnv } from "@/lib/docs/tryit-request";
import { cn } from "@/lib/utils";
import { AlertTriangle, Play, RotateCcw } from "lucide-react";
import { useEffect, type KeyboardEvent } from "react";
import { HttpMethodTag } from "../HttpMethodTag";
import { CopyButton, TabButton } from "../code-ui";
import "../code-samples.css";
import { RequestPane } from "./RequestPane";
import { ResponsePane } from "./ResponsePane";
import { useDocsDark } from "./useDocsDark";
import { useTryItState } from "./useTryItState";

const ENVS = Object.keys(API_ENVIRONMENTS) as TryItEnv[];

/**
 * The "Test Request" dialog for one endpoint: breadcrumb + method + live URL
 * + environment toggle + Send in the header, request form on the left, live
 * response on the right. Styled entirely with the docs `--rp-*` tokens and
 * carries the docs dark class itself (it renders in a portal).
 *
 * Default export so `useTryIt` can lazy-load it as its own chunk.
 */
const TryItDialog = ({
	spec,
	open,
	onOpenChange,
}: {
	spec: ApiSpec;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	const dark = useDocsDark();
	const ctl = useTryItState(spec, open);
	const { state, dispatch, send, abort, clearSaved } = ctl;
	const product = API_PRODUCTS_MAP[spec.productId];
	const url = resolveEndpointUrl(
		spec,
		state.params,
		API_ENVIRONMENTS[state.env].baseUrl,
	);
	const production = state.env === "production";
	const sending = state.status === "sending";

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			void send();
		}
	};

	// A production+financial confirmation must not outlive a closed dialog.
	useEffect(() => {
		if (!open && state.armed) dispatch({ type: "setEnv", env: state.env });
	}, [open, state.armed, state.env, dispatch]);

	const sendLabel = sending
		? "Sending…"
		: state.armed
			? "Confirm production send"
			: "Send";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				onKeyDown={onKeyDown}
				className={cn(
					"docs-rightpane flex h-[92vh] w-[min(96vw,80rem)] max-w-none flex-col gap-0 overflow-hidden border-[var(--rp-line)] bg-[var(--rp-bg)] p-0 text-[var(--rp-fg)] sm:rounded-2xl",
					dark && "dark",
				)}
			>
				<DialogTitle className="sr-only">Test {spec.name}</DialogTitle>
				<DialogDescription className="sr-only">
					Send a live request to the {spec.name} API and inspect the response.
				</DialogDescription>

				{/* Header */}
				<div className="border-b border-[var(--rp-line)] bg-[var(--rp-card)] px-5 py-3 pr-12">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						{product && product.name !== spec.name && (
							<>
								<span className="text-[var(--rp-fg3)]">{product.name}</span>
								<span className="text-[var(--rp-ln)]">›</span>
							</>
						)}
						<span className="font-semibold text-[var(--rp-fg)]">
							{spec.name}
						</span>
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<HttpMethodTag method={spec.method} variant="soft" />
						<div className="flex min-w-0 flex-1 items-center gap-1.5">
							<code
								className="min-w-0 truncate font-mono text-xs text-[var(--rp-fg2)]"
								title={url}
							>
								{url}
							</code>
							<CopyButton text={url} />
						</div>
						<div
							className="flex gap-1 rounded-lg border border-[var(--rp-line)] bg-[var(--rp-bg)] p-0.5"
							role="tablist"
							aria-label="Environment"
						>
							{ENVS.map((env) => (
								<TabButton
									key={env}
									active={state.env === env}
									onClick={() => dispatch({ type: "setEnv", env })}
								>
									{API_ENVIRONMENTS[env].label}
								</TabButton>
							))}
						</div>
						<button
							type="button"
							onClick={clearSaved}
							title="Clear saved request and reset to the documented example"
							aria-label="Clear saved request"
							className="cursor-pointer rounded-md border border-[var(--rp-btnline)] bg-[var(--rp-btn)] p-1.5 text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]"
						>
							<RotateCcw className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={() => void send()}
							disabled={sending}
							className={cn(
								"inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
								state.armed
									? "bg-rose-600 text-white"
									: "bg-[var(--rp-fg)] text-[var(--rp-bg)]",
							)}
						>
							<Play className="h-3.5 w-3.5 fill-current" />
							{sendLabel}
						</button>
					</div>
					{production && (
						<div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
							<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							<span>
								<strong>Production.</strong> This sends a real request to{" "}
								<code>{API_ENVIRONMENTS.production.baseUrl}</code> with your own
								keys
								{spec.financial &&
									" and may move money — Send asks for a second click"}
								. The demo UAT keys are never used here.
							</span>
						</div>
					)}
				</div>

				{/* Panes */}
				<div className="docs-scroll grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
					<div className="docs-scroll min-h-0 p-4 lg:overflow-y-auto lg:border-r lg:border-[var(--rp-line)]">
						<RequestPane spec={spec} ctl={ctl} />
					</div>
					<div className="docs-scroll min-h-0 bg-[var(--rp-code)] lg:overflow-y-auto">
						<ResponsePane
							spec={spec}
							state={state}
							env={state.env}
							onAbort={abort}
						/>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default TryItDialog;
