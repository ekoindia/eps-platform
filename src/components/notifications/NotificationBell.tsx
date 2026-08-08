import {
	NotificationDetail,
	NotificationList,
} from "@/components/notifications/NotificationList";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	markNotificationRead,
	subscribeNotificationPanel,
	useNotifications,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The header's notification bell.
 *
 * Renders NOTHING until the first poll has returned a non-empty list. That is
 * Eloka's rule — no notifications, no bell — and it also happens to be what
 * keeps the prerendered markup honest: `useNotifications()` reports an empty
 * list during SSG and on the first client paint, so the server tree and the
 * hydrated tree agree, and the bell appears later, after hydration has
 * committed. See `docs/ssg-hydration.md`.
 * @param props.isLight - True on a dark header, where the icon must be light.
 */
export function NotificationBell({ isLight = false }: { isLight?: boolean }) {
	const { items, unread } = useNotifications();
	const [openId, setOpenId] = useState<number | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);

	// "View all" on the console card opens THIS panel; the two live in different
	// subtrees, so the request arrives through the store rather than a prop.
	useEffect(() => subscribeNotificationPanel(() => setPanelOpen(true)), []);

	if (items.length === 0) return null;

	const open = (id: number) => {
		markNotificationRead(id);
		setOpenId(id);
	};
	const opened = items.find((item) => item.id === openId) ?? null;

	return (
		<>
			<Popover open={panelOpen} onOpenChange={setPanelOpen}>
				<PopoverTrigger
					aria-label={
						unread ? `Notifications, ${unread} unread` : "Notifications"
					}
					className={cn(
						"relative flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors",
						isLight
							? "text-white/80 hover:bg-white/15 hover:text-white"
							: "text-eko-slate hover:bg-muted hover:text-eko-navy",
					)}
				>
					{unread ? (
						<BellRing className="size-[1.15rem]" />
					) : (
						<Bell className="size-[1.15rem]" />
					)}
					{unread > 0 && (
						<span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold leading-4 text-white">
							{unread > 9 ? "9+" : unread}
						</span>
					)}
				</PopoverTrigger>
				<PopoverContent
					align="end"
					collisionPadding={8}
					className="w-[min(22rem,calc(100vw-1rem))] p-0"
				>
					<p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Notifications
					</p>
					<div className="max-h-[70vh] overflow-y-auto">
						<NotificationList items={items} onOpen={open} />
					</div>
				</PopoverContent>
			</Popover>

			<NotificationDetail item={opened} onClose={() => setOpenId(null)} />
		</>
	);
}

export default NotificationBell;
