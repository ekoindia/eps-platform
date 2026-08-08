import {
	NotificationDetail,
	NotificationList,
} from "@/components/notifications/NotificationList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	markNotificationRead,
	requestNotificationPanel,
	useNotifications,
} from "@/lib/notifications";
import { useState } from "react";

/** Rows shown on Home. The bell's panel is where the rest live. */
const HOME_LIMIT = 5;

/**
 * The console home page's notification card: UNREAD items only.
 *
 * Home is a working page, so this is a to-do list rather than an archive — an
 * item the partner has already read has had its moment, and the bell's panel is
 * where the whole list lives. Matches Eloka's widget in `unreadOnly` mode.
 *
 * Renders nothing when nothing is unread: an empty "Notifications" card is a
 * question with no answer. Reads the same store the header bell does, so opening
 * an item in one repaints the other.
 */
export function NotificationsCard() {
	const { items } = useNotifications();
	const [openId, setOpenId] = useState<number | null>(null);

	const unread = items.filter((item) => !item.read);
	const open = (id: number) => {
		markNotificationRead(id);
		setOpenId(id);
	};
	// Resolved against the FULL list, never `unread`: opening a row marks it read,
	// which drops it out of `unread` on the very next render. Looking it up there
	// would slam the detail dialog shut the instant it opened.
	const opened = items.find((item) => item.id === openId) ?? null;

	// Nothing to list AND nothing open. The second half matters: opening the last
	// unread item empties `unread`, and bailing on that alone would unmount the
	// dialog the click had just opened.
	if (unread.length === 0 && !opened) return null;

	return (
		<>
			{unread.length > 0 ? (
				<Card>
					<CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
						<CardTitle>Notifications</CardTitle>
						{/* Shown whenever the card is hiding something — true both past the
						    row limit AND as soon as anything has been read, since read items
						    never appear here. The panel it opens is the header bell's; see
						    `requestNotificationPanel`. */}
						{items.length > Math.min(unread.length, HOME_LIMIT) ? (
							<button
								type="button"
								onClick={requestNotificationPanel}
								className="cursor-pointer text-sm font-medium text-eko-gold-ink underline-offset-4 hover:underline dark:text-eko-gold"
							>
								View all ({items.length})
							</button>
						) : null}
					</CardHeader>
					<CardContent className="px-0 pb-0">
						<NotificationList items={unread} onOpen={open} limit={HOME_LIMIT} />
					</CardContent>
				</Card>
			) : null}

			<NotificationDetail item={opened} onClose={() => setOpenId(null)} />
		</>
	);
}

export default NotificationsCard;
