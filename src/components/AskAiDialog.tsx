import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, authClient } from "@/lib/auth/client";
import {
	MAX_MESSAGE_CHARS,
	type ChatMessage,
	sourceLabel,
	trimHistory,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

interface AskAiDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Question that opened the dialog; asked automatically on first render. */
	seedQuery: string;
	/**
	 * Called when the backend reports the assistant is switched off for this
	 * deployment, so the caller can stop offering it for the rest of the session.
	 */
	onDisabled?: () => void;
}

/** One rendered turn, plus the sources that informed an assistant answer. */
interface Turn extends ChatMessage {
	sources?: string[];
}

/**
 * Markdown renderer for answers.
 *
 * `react-markdown` escapes raw HTML unless `rehype-raw` is added — it is not,
 * deliberately: this text comes from a model that has just read user input, so
 * the safe default is the whole point. Links are forced to open in a new tab
 * with `noreferrer`, since they may point off-site.
 */
const answerComponents = {
	a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
		<a
			href={href}
			target="_blank"
			rel="noreferrer noopener"
			className="text-primary underline underline-offset-2"
		>
			{children}
		</a>
	),
	code: ({
		children,
		className,
	}: {
		children?: React.ReactNode;
		className?: string;
	}) =>
		className ? (
			<code className={cn(className, "text-[0.85em]")}>{children}</code>
		) : (
			<code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
				{children}
			</code>
		),
	pre: ({ children }: { children?: React.ReactNode }) => (
		<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
			{children}
		</pre>
	),
};

/**
 * The grounded EPS docs assistant, as a popup conversation.
 *
 * History is client-held and in-memory only: closing the dialog discards it,
 * and nothing is ever persisted here or server-side.
 */
export const AskAiDialog = ({
	open,
	onOpenChange,
	seedQuery,
	onDisabled,
}: AskAiDialogProps) => {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [draft, setDraft] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const seeded = useRef<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	/** Sends `text` and appends the answer. History is trimmed to the cap. */
	const send = async (text: string, prior: Turn[]) => {
		const next: Turn[] = [...prior, { role: "user", content: text }];
		setTurns(next);
		setPending(true);
		setError(null);
		try {
			const reply = await authClient.ask(
				trimHistory(next.map(({ role, content }) => ({ role, content }))),
			);
			setTurns([
				...next,
				{ role: "assistant", content: reply.answer, sources: reply.sources },
			]);
		} catch (err) {
			const code = err instanceof ApiError ? err.code : "";
			if (code === "CHAT_DISABLED") {
				onDisabled?.();
				onOpenChange(false);
				return;
			}
			setError(
				code === "CHAT_BUDGET_EXHAUSTED"
					? "The assistant has reached its limit for this month. Please try again later."
					: code === "CHAT_BUNDLE_UNAVAILABLE"
						? "The assistant is still loading its documentation. Try again in a moment."
						: code === "RATE_LIMITED"
							? "You've asked a lot of questions just now — give it a minute."
							: "Something went wrong reaching the assistant. Please try again.",
			);
			// Drop the unanswered question so a retry does not double-send it.
			setTurns(prior);
		} finally {
			setPending(false);
		}
	};

	// Ask the seed question once per opening, not once per render.
	useEffect(() => {
		if (!open) {
			seeded.current = null;
			return;
		}
		const q = seedQuery.trim();
		if (!q || seeded.current === q) return;
		seeded.current = q;
		setTurns([]);
		setDraft("");
		void send(q, []);
		// `send` is stable enough for this effect's purpose; re-running it on
		// every render would re-ask the question.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, seedQuery]);

	// Keep the newest turn in view as answers arrive.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [turns, pending]);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		const text = draft.trim();
		if (!text || pending) return;
		setDraft("");
		void send(text, turns);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(80vh,640px)] flex-col gap-0 p-0 sm:max-w-2xl">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle className="flex items-center gap-2 text-base">
						<Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
						Ask AI about EPS
					</DialogTitle>
					<DialogDescription className="text-xs">
						Answers are grounded in the EPS API reference. Don&rsquo;t paste
						secrets &mdash; messages are sent to an AI provider.
					</DialogDescription>
				</DialogHeader>

				<div
					ref={scrollRef}
					className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
				>
					{turns.map((turn, i) => (
						<div
							key={`${turn.role}-${i}`}
							className={cn(
								"text-sm",
								turn.role === "user"
									? "text-foreground"
									: "text-muted-foreground",
							)}
						>
							{turn.role === "user" ? (
								<p className="rounded-lg bg-muted px-3 py-2 font-medium">
									{turn.content}
								</p>
							) : (
								<div className="prose prose-sm max-w-none dark:prose-invert">
									<ReactMarkdown components={answerComponents}>
										{turn.content}
									</ReactMarkdown>
									{turn.sources && turn.sources.length > 0 && (
										<p className="mt-2 text-xs text-muted-foreground/80">
											Sources: {turn.sources.map(sourceLabel).join(" · ")}
										</p>
									)}
								</div>
							)}
						</div>
					))}

					{pending && (
						<p
							className="flex items-center gap-2 text-sm text-muted-foreground"
							role="status"
						>
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							Looking it up&hellip;
						</p>
					)}
					{error && (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					)}
				</div>

				<form
					onSubmit={submit}
					className="flex items-center gap-2 border-t px-5 py-3"
				>
					<label htmlFor="ask-ai-input" className="sr-only">
						Ask a follow-up question
					</label>
					<input
						id="ask-ai-input"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						maxLength={MAX_MESSAGE_CHARS}
						placeholder="Ask a follow-up…"
						disabled={pending}
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
					/>
					<button
						type="submit"
						disabled={pending || !draft.trim()}
						aria-label="Send"
						className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
					>
						<Send className="h-4 w-4" aria-hidden="true" />
					</button>
				</form>
			</DialogContent>
		</Dialog>
	);
};
