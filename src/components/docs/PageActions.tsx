import { ClaudeCodeIcon } from "@/components/icons/ClaudeCodeIcon";
import { McpIcon } from "@/components/icons/McpIcon";
import { EPS_MCP_CMD, SITE_URL } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import {
	ChevronDown,
	Copy,
	Download,
	ExternalLink,
	FileText,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { SiOpenai, SiOpenapiinitiative, SiPostman } from "react-icons/si";
import { toast } from "sonner";

/** Pre-built, page-independent integration artifacts (served from `dist/`). */
const POSTMAN_URL = "/agent/eps.postman_collection.json";
const OPENAPI_URL = "/openapi.json";

/**
 * Copy to clipboard with a guarded, SSG-safe `navigator.clipboard` read (only
 * touched inside the handler, never at module scope). Returns `false` on
 * unavailable clipboard / insecure context / denied permission so callers can
 * surface a fallback. Mirrors the helper in `pages/ai/CommandBlock.tsx`.
 */
async function copyText(text: string): Promise<boolean> {
	if (typeof navigator === "undefined" || !navigator.clipboard) return false;
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Deliberately generic prompt: many guide/endpoint pages won't have every
 * section (auth, errors, …), so we avoid promising specifics that could mislead
 * the model. The model fetches the `.md` twin itself and summarises it.
 */
function buildLlmPrompt(
	mdUrl: string,
	title: string,
	kind: "endpoint" | "guide",
): string {
	const noun = kind === "guide" ? "integration guide" : "API reference";
	return (
		`I'm integrating with the Eko EPS fintech API. Please read this ${noun} page: ${mdUrl}\n\n` +
		`It's a clean Markdown document for "${title}", covering the request/response details, ` +
		`parameters, and examples where applicable. Read it carefully, then give me a short 2–3 line ` +
		`summary of what it does and how to call it, and wait for my questions.`
	);
}

/** A single menu row — shared styling for links and buttons. */
const ROW =
	"flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted";
const ICON = "h-4 w-4 shrink-0 text-muted-foreground";
/** Faded trailing affordance icon (external-link / download / copy). */
const TRAIL = "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50";

/**
 * "Copy Page ▾" — a split button (primary Copy Page + a CSS-only `<details>`
 * disclosure) that lets a reader take the current docs page elsewhere: copy its
 * Markdown twin, open it pre-loaded in ChatGPT/Claude, view the raw `.md`, or
 * grab the global Postman / OpenAPI / MCP integration artifacts.
 *
 * Every target already exists as a deployed artifact (`/docs/<slug>.md`,
 * `/agent/…`, `/openapi.json`, {@link EPS_MCP_CMD}), so this adds no build step
 * and "Copy Page" fetches the `.md` lazily on click — no client-side markdown
 * renderer. Styled with site theme tokens (not the right-pane `--rp-*` vars) so
 * it reads correctly both atop the right rail and in the middle content column.
 *
 * @param mdPath Site-relative path to the Markdown twin, e.g. `/docs/foo.md`.
 * @param title  Page title (endpoint name or guide title) for the LLM prompt.
 * @param kind   Whether this page is an API endpoint or a written guide.
 */
export const PageActions = ({
	mdPath,
	title,
	kind,
	className,
}: {
	mdPath: string;
	title: string;
	kind: "endpoint" | "guide";
	className?: string;
}) => {
	const ref = useRef<HTMLDetailsElement>(null);
	const close = () => {
		if (ref.current) ref.current.open = false;
	};

	// Native <details> doesn't close on outside-click or Escape — wire both up.
	useEffect(() => {
		const onPointerDown = (e: PointerEvent) => {
			if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	const mdUrl = `${SITE_URL}${mdPath}`;
	const prompt = encodeURIComponent(buildLlmPrompt(mdUrl, title, kind));
	const chatgptUrl = `https://chatgpt.com/?q=${prompt}`;
	const claudeUrl = `https://claude.ai/new?q=${prompt}`;

	const copyPage = async () => {
		try {
			const res = await fetch(mdPath);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const md = await res.text();
			const ok = await copyText(md);
			if (ok) toast.success("Page copied as Markdown");
			else toast.error('Clipboard unavailable — use "View as Markdown"');
		} catch {
			toast.error('Couldn\'t copy this page — try "View as Markdown"');
		}
	};

	const copyMcp = async () => {
		const ok = await copyText(EPS_MCP_CMD);
		if (ok) toast.success("MCP command copied");
		else toast.error("Clipboard unavailable");
		close();
	};

	return (
		<div className={cn("not-prose flex justify-end", className)}>
			<div className="inline-flex items-stretch rounded-lg border border-border bg-background text-foreground shadow-sm">
				<button
					type="button"
					onClick={copyPage}
					className="inline-flex cursor-pointer items-center gap-1.5 rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
				>
					<Copy className="h-3.5 w-3.5" />
					Copy Page
				</button>

				<details ref={ref} className="relative border-l border-border">
					<summary
						aria-label="More page actions"
						className="flex h-full cursor-pointer list-none items-center rounded-r-lg px-1.5 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
					>
						<ChevronDown className="h-3.5 w-3.5" />
					</summary>

					<div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
						<a
							href={chatgptUrl}
							target="_blank"
							rel="noopener noreferrer"
							onClick={close}
							className={ROW}
						>
							<SiOpenai className={ICON} />
							Open in ChatGPT
							<ExternalLink className={TRAIL} />
						</a>
						<a
							href={claudeUrl}
							target="_blank"
							rel="noopener noreferrer"
							onClick={close}
							className={ROW}
						>
							<ClaudeCodeIcon className={ICON} />
							Open in Claude
							<ExternalLink className={TRAIL} />
						</a>
						<a
							href={mdPath}
							target="_blank"
							rel="noopener noreferrer"
							onClick={close}
							className={ROW}
						>
							<FileText className={ICON} />
							View as Markdown
							<ExternalLink className={TRAIL} />
						</a>

						<div className="my-1 h-px bg-border" />

						<a href={POSTMAN_URL} download onClick={close} className={ROW}>
							<SiPostman className={ICON} />
							Get Postman Collection
							<Download className={TRAIL} />
						</a>
						<a href={OPENAPI_URL} download onClick={close} className={ROW}>
							<SiOpenapiinitiative className={ICON} />
							Download OpenAPI
							<Download className={TRAIL} />
						</a>
						<button
							type="button"
							onClick={copyMcp}
							className={cn(ROW, "cursor-pointer")}
						>
							<McpIcon className={ICON} />
							Copy MCP command
							<Copy className={TRAIL} />
						</button>
					</div>
				</details>
			</div>
		</div>
	);
};
