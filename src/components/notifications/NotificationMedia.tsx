import { MarkdownProse } from "@/components/docs/MarkdownProse";
import type { NotificationView } from "@/lib/notifications";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * The heavy half of a notification's detail view: markdown, video and QR.
 *
 * Split out and loaded with `React.lazy` because the bell lives in the global
 * Header, on every page of the site. `react-markdown` and `qrcode` must not be
 * in the entry bundle for a panel most visitors never open.
 */

/** Renders `body` as markdown.
 *
 * `MarkdownProse` runs react-markdown WITHOUT `rehype-raw`, so raw HTML in the
 * source is inert text rather than markup. That is what makes it safe to render
 * a string authored upstream — keep it that way.
 * @param props.body - The markdown source.
 */
export function NotificationMarkdown({ body }: { body: string }) {
	return <MarkdownProse content={body} />;
}

/**
 * A YouTube video, as a poster that becomes an embed once clicked.
 *
 * Nothing is requested from a third party until the user asks for the video —
 * not even the thumbnail, which is why the poster is drawn locally. Opening a
 * notification should not tell Google that this partner opened it.
 * @param props.videoId - An 11-character YouTube id, already validated upstream.
 */
export function NotificationVideo({ videoId }: { videoId: string }) {
	const [playing, setPlaying] = useState(false);

	if (!playing) {
		return (
			<button
				type="button"
				onClick={() => setPlaying(true)}
				aria-label="Play video"
				className="group mt-4 flex aspect-video w-full cursor-pointer items-center justify-center rounded-md border border-border bg-muted transition-colors hover:bg-muted/70"
			>
				<span className="flex size-14 items-center justify-center rounded-full bg-background/90 shadow-sm transition-transform group-hover:scale-105">
					<Play className="ml-0.5 size-6" />
				</span>
			</button>
		);
	}

	return (
		<iframe
			// nocookie: the privacy-preserving host, for the one case where the user
			// has explicitly asked to watch.
			src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
			title="Notification video"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
			allowFullScreen
			className="mt-4 aspect-video w-full rounded-md border border-border"
		/>
	);
}

/**
 * A QR code for an opaque payload.
 *
 * The payload is printed beneath it, selectable: a code that will not scan —
 * a cracked camera, a screen-reader user, a screenshot pasted into chat — is
 * useless without the string it encodes.
 * @param props.payload - The string to encode.
 */
export function NotificationQr({ payload }: { payload: string }) {
	const [dataUrl, setDataUrl] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		void QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1 })
			.then((url) => {
				if (alive) setDataUrl(url);
			})
			.catch(() => {
				// An unencodable payload still shows as text below.
				if (alive) setDataUrl(null);
			});
		return () => {
			alive = false;
		};
	}, [payload]);

	return (
		<div className="mt-4 flex flex-col items-center gap-2">
			{dataUrl ? (
				<img
					src={dataUrl}
					alt="QR code"
					className="size-44 rounded-md border border-border bg-white p-2"
				/>
			) : null}
			<code className="max-w-full select-all break-all text-center text-xs text-muted-foreground">
				{payload}
			</code>
		</div>
	);
}

/** Every rich part of one notification, in reading order. */
export default function NotificationMedia({
	item,
}: {
	item: NotificationView;
}) {
	return (
		<>
			{item.markdown ? <NotificationMarkdown body={item.body} /> : null}
			{item.youtube ? <NotificationVideo videoId={item.youtube} /> : null}
			{item.qrCode ? <NotificationQr payload={item.qrCode} /> : null}
		</>
	);
}
