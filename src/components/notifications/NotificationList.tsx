import { useOptionalConnectDialogs } from "@/components/connect/DialogHost";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { NotificationView } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import { lazy, Suspense } from "react";

/** `priority: 3`. Gets an accent stripe and a longer toast. */
const PRIORITY_HIGH = 3;

/** `state` values: 1 neutral, 2 positive, 3 negative. */
const STATE_POSITIVE = 2;
const STATE_NEGATIVE = 3;

/**
 * Markdown, video and QR rendering, loaded on demand.
 *
 * The bell is mounted in the global Header, so `react-markdown` and `qrcode`
 * would otherwise be in the entry bundle of every page on the site.
 */
const NotificationMedia = lazy(
	() => import("@/components/notifications/NotificationMedia"),
);

/** Whether opening this item needs the lazy media chunk. */
function hasRichMedia(item: NotificationView): boolean {
	return item.markdown || Boolean(item.youtube) || Boolean(item.qrCode);
}

/** `notifyTime` as a reader in India would write it. */
function formatNotifyTime(iso: string): string {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		// The instant is universal; the reader is not. Eko's users are in IST.
		timeZone: "Asia/Kolkata",
	});
}

/** A success or failure marker, for the notifications that carry one. */
function StateIcon({ state }: { state: NotificationView["state"] }) {
	if (state === STATE_POSITIVE) {
		return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />;
	}
	if (state === STATE_NEGATIVE) {
		return <CircleAlert className="size-4 shrink-0 text-destructive" />;
	}
	return null;
}

/** The image or glyph opening a row. */
function Thumbnail({ item }: { item: NotificationView }) {
	return (
		<span className="relative shrink-0">
			{!item.read && (
				<span
					// Decorative: the row's accessible name already says "unread".
					aria-hidden
					className="absolute -left-1 -top-1 size-3 rounded-full border-2 border-background bg-eko-gold"
				/>
			)}
			{item.image ? (
				<img
					src={item.image}
					alt=""
					loading="lazy"
					// The image host is upstream's, not ours. No referrer means the URL
					// of the page the partner is on never reaches it.
					referrerPolicy="no-referrer"
					className={cn(
						"size-10 rounded-md border border-border object-cover",
						item.read && "opacity-70",
					)}
				/>
			) : (
				<span
					className={cn(
						"flex size-10 items-center justify-center rounded-full border border-border bg-muted",
						item.read && "opacity-70",
					)}
				>
					<Bell className="size-4 text-muted-foreground" />
				</span>
			)}
		</span>
	);
}

/**
 * One row in the list.
 * @param props.item - The notification.
 * @param props.onOpen - Called with its id when the row is activated.
 */
export function NotificationRow({
	item,
	onOpen,
}: {
	item: NotificationView;
	onOpen: (id: number) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpen(item.id)}
			className={cn(
				"flex w-full cursor-pointer gap-3 border-l-2 px-3 py-3 text-left transition-colors hover:bg-muted/60",
				item.priority >= PRIORITY_HIGH
					? "border-l-eko-gold"
					: "border-l-transparent",
				item.read && "opacity-70",
			)}
		>
			<Thumbnail item={item} />
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5">
					<StateIcon state={item.state} />
					<span
						className={cn(
							"truncate text-sm",
							item.read ? "font-medium" : "font-semibold",
						)}
					>
						{item.title}
					</span>
				</span>
				{item.preview.map((line, index) => (
					<span
						key={index}
						className="mt-0.5 block truncate text-xs text-muted-foreground"
					>
						{line}
					</span>
				))}
			</span>
			{!item.read && <span className="sr-only">Unread</span>}
		</button>
	);
}

/**
 * The list itself. Renders nothing when there is nothing to show, so a caller
 * never has to draw an empty panel.
 * @param props.items - Notifications, newest first.
 * @param props.onOpen - Called with an id when a row is activated.
 * @param props.limit - Rows to show, when the surface wants fewer than all.
 */
export function NotificationList({
	items,
	onOpen,
	limit,
}: {
	items: readonly NotificationView[];
	onOpen: (id: number) => void;
	limit?: number;
}) {
	const shown = limit ? items.slice(0, limit) : items;
	if (shown.length === 0) return null;
	return (
		<div className="divide-y divide-border">
			{shown.map((item) => (
				<NotificationRow key={item.id} item={item} onOpen={onOpen} />
			))}
		</div>
	);
}

/**
 * The full text of one notification.
 * @param props.item - The notification, or null when nothing is open.
 * @param props.onClose - Called when the dialog is dismissed.
 */
export function NotificationDetail({
	item,
	onClose,
}: {
	item: NotificationView | null;
	onClose: () => void;
}) {
	// Optional: the bell renders in the site header, above pages that host no
	// dialog stack of their own. Without a host the poster simply stays a picture.
	const dialogs = useOptionalConnectDialogs();
	if (!item) return null;
	const timestamp = formatNotifyTime(item.notifyTime);
	const poster = item.image;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-left">
						<StateIcon state={item.state} />
						{item.title}
					</DialogTitle>
					{/* Radix wants a description for the dialog's accessible name; the
					    timestamp is the one line that is always present. */}
					<DialogDescription className="text-left">
						{timestamp}
					</DialogDescription>
				</DialogHeader>

				{item.markdown ? null : (
					<div className="space-y-2 text-sm text-foreground/80">
						{item.body
							.split("\n")
							.filter((line) => line.trim() !== "")
							.map((line, index) => (
								<p key={index}>{line}</p>
							))}
					</div>
				)}

				{hasRichMedia(item) ? (
					<Suspense
						fallback={
							<div className="h-24 animate-pulse rounded-md bg-muted" />
						}
					>
						<NotificationMedia item={item} />
					</Suspense>
				) : null}

				{poster ? (
					<button
						type="button"
						onClick={() => void dialogs?.showFile(poster, { type: "image" })}
						// The same full-screen viewer the KYC upload preview uses — it
						// zooms and pans, which a notification poster of a rate card or a
						// QR needs as much as an attachment does.
						className={cn("mt-4 block w-full", dialogs && "cursor-zoom-in")}
						aria-label={dialogs ? "View image full screen" : undefined}
						disabled={!dialogs}
					>
						<img
							src={poster}
							alt=""
							loading="lazy"
							referrerPolicy="no-referrer"
							className="w-full rounded-md border border-border"
						/>
					</button>
				) : null}

				{item.link ? (
					<DialogFooter className="sm:justify-start">
						<Button asChild variant="default">
							<a href={item.link} target="_blank" rel="noopener noreferrer">
								{item.linkLabel || "Open link"}
								<ExternalLink className="ml-1.5 size-3.5" />
							</a>
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
