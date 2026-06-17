import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Copies the given text to the clipboard and surfaces a toast. Client-only —
 * `navigator.clipboard` is read inside the handler (never at module scope) so
 * SSG prerendering never touches browser globals.
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

interface CopyButtonProps {
	text: string;
	className?: string;
	/** Accessible label; defaults to "Copy command". */
	label?: string;
}

/** Small icon button that copies `text` and shows a check + toast on success. */
export const CopyButton = ({
	text,
	className,
	label = "Copy command",
}: CopyButtonProps) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyText(text);
		if (!ok) return;
		setCopied(true);
		toast.success("Copied");
		window.setTimeout(() => setCopied(false), 1500);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label={label}
			title={label}
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-md p-2 text-current/70 transition-colors hover:bg-white/10 hover:text-current cursor-pointer",
				className,
			)}
		>
			{copied ? (
				<Check className="h-4 w-4 text-eko-gold" />
			) : (
				<Copy className="h-4 w-4" />
			)}
		</button>
	);
};

interface CommandBlockProps {
	/** Command/text shown and copied. */
	text: string;
	/** Optional tiny label above the command (e.g. "MCP", "Pack file"). */
	caption?: string;
	/** Render on a dark navy surface (hero / CTA band) vs. light card surface. */
	tone?: "dark" | "light";
	className?: string;
	/** Optional leading prompt glyph (e.g. "$"). Decorative. */
	prompt?: string;
}

/**
 * A monospace command line with an inline copy button. Used for every
 * copy-to-clipboard snippet on the /ai page (install commands, pack files).
 */
export const CommandBlock = ({
	text,
	caption,
	tone = "light",
	className,
	prompt = "$",
}: CommandBlockProps) => {
	const isDark = tone === "dark";
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			{caption && (
				<span
					className={cn(
						"text-[11px] font-semibold uppercase tracking-wider",
						isDark ? "text-white/50" : "text-muted-foreground",
					)}
				>
					{caption}
				</span>
			)}
			<div
				className={cn(
					"flex items-center gap-3 rounded-lg border px-4 py-3 font-mono text-sm",
					isDark
						? "border-white/10 bg-white/5 text-white"
						: "border-border bg-eko-navy text-white",
				)}
			>
				{prompt && (
					<span className="select-none text-eko-gold" aria-hidden="true">
						{prompt}
					</span>
				)}
				<code className="flex-1 overflow-x-auto whitespace-nowrap docs-scroll">
					{text}
				</code>
				<CopyButton text={text} />
			</div>
		</div>
	);
};
