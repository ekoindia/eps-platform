import { Minus, Plus } from "lucide-react";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";

/** Kinds of content the viewer knows how to render. */
export type FileViewType =
	| "pdf"
	| "image"
	| "youtube"
	| "video"
	| "audio"
	| "media"
	| "url"
	| "html";

/**
 * Viewer options, as sent by the transaction widget.
 *
 * The widget also sends `fileName`, `link`, `whatsapp` and `download`. Eloka's
 * viewer never read them either — they are dropped rather than modelled.
 */
export interface FileViewOptions {
	/** Overrides the type sniffed from the file extension. */
	type?: FileViewType;
	/** Caption for the framed types (pdf, html, url). */
	label?: string;
	/** Alternate spelling of `label` some flows send. */
	header?: string;
}

/** Extension → type. Anything unrecognised is treated as a page to frame. */
const TYPE_BY_EXTENSION: Record<string, FileViewType> = {
	pdf: "pdf",
	jpg: "image",
	jpeg: "image",
	png: "image",
	gif: "image",
	webp: "image",
	mp4: "video",
	avi: "video",
	mov: "video",
	mkv: "video",
	mp3: "audio",
	wav: "audio",
	ogg: "audio",
	htm: "html",
	html: "html",
};

/**
 * Whether a URL is safe to hand to an `<iframe>` or media element.
 *
 * The URL comes from the transaction flow, and `javascript:` in an iframe `src`
 * executes in this document's origin — where the widget's session tokens live.
 * Relative paths and the http(s)/data/blob schemes are all it ever legitimately
 * sends.
 * @param url - The URL to check.
 * @returns True when it is safe to render.
 */
function isSafeUrl(url: string): boolean {
	try {
		const { protocol } = new URL(url, window.location.origin);
		return ["http:", "https:", "data:", "blob:"].includes(protocol);
	} catch {
		return false;
	}
}

/**
 * Sniffs the content type from a `data:` URL's MIME type, or the file extension.
 *
 * The MIME branch exists because a `data:` URL has no extension: the whole
 * payload came back as the "extension" and fell through to `html`, so an edited
 * capture was framed in an iframe — at its original size, with scrollbars —
 * instead of being shown in the image viewer.
 * @param file - The file URL.
 * @returns The matching type, defaulting to `html` so an unrecognised URL is
 *   framed as a page rather than refused.
 */
function sniffType(file: string): FileViewType {
	const mime = /^data:([^;,]+)/.exec(file)?.[1]?.toLowerCase();
	if (mime) {
		if (mime.startsWith("image/")) return "image";
		if (mime.startsWith("video/")) return "video";
		if (mime.startsWith("audio/")) return "audio";
		return mime === "application/pdf" ? "pdf" : "html";
	}
	const extension = file.split("?")[0].split(".").pop()?.toLowerCase();
	return (extension && TYPE_BY_EXTENSION[extension]) || "html";
}

/**
 * Rewrites a YouTube watch/short URL to its embeddable form.
 *
 * The widget sends a bare video id which the event layer expands to a watch
 * URL; a watch URL refuses to load in an iframe.
 * @param url - Any YouTube URL, or an already-embeddable one.
 * @returns The `/embed/` URL, or the input unchanged if no id is found.
 */
function toYouTubeEmbed(url: string): string {
	const id = /(?:v=|youtu\.be\/|\/embed\/)([\w-]{6,})/.exec(url)?.[1];
	return id
		? `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0`
		: url;
}

/** One button press, and the granularity a pinch accumulates in. */
const ZOOM_STEP = 1.25;
/** Past this an attachment is pixels, not evidence. */
const MAX_ZOOM = 8;

/**
 * A full-screen image, fitted to the viewport, that zooms and pans.
 *
 * Zoom is applied as an explicit size rather than a transform, because a
 * transform paints outside the scroll area instead of extending it — there
 * would be nothing to scroll, and so no way to reach the part of a zoomed
 * document the user is trying to read.
 * @param props.file - URL of the image.
 * @param props.onLoad - Called once the image has decoded.
 * @param props.placeholder - Shown until then.
 */
function ImageView({
	file,
	onLoad,
	placeholder,
}: {
	file: string;
	onLoad: () => void;
	placeholder: ReactNode;
}) {
	const scroller = useRef<HTMLDivElement | null>(null);
	// The size the image settled at under the CSS caps. Zoom multiplies it, so
	// zoom 1 is exactly the old fit-to-screen behaviour, small images included:
	// blowing a 200px thumbnail up to fill a monitor only makes it blurry.
	const [fitted, setFitted] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [zoom, setZoom] = useState(1);
	const previousZoom = useRef(1);

	/** Multiplies the zoom, clamped to fit-to-screen at the bottom. */
	function zoomBy(factor: number) {
		setZoom((current) => Math.min(Math.max(current * factor, 1), MAX_ZOOM));
	}

	// Registered directly rather than through `onWheel`: React's wheel listener
	// is passive, so `preventDefault` there cannot stop the browser zooming the
	// whole page instead of the image.
	useEffect(() => {
		const node = scroller.current;
		if (!node) return;
		const handleWheel = (event: WheelEvent) => {
			// What a trackpad pinch (and ctrl+wheel) arrives as. A plain wheel is
			// left alone, so it still scrolls — which is how a zoomed image is panned.
			if (!event.ctrlKey) return;
			event.preventDefault();
			zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
		};
		node.addEventListener("wheel", handleWheel, { passive: false });
		return () => node.removeEventListener("wheel", handleWheel);
	}, []);

	// Keeps whatever was in the middle of the screen in the middle of it. The
	// scroller would otherwise hold its offsets while the image grew around them,
	// so every zoom would throw the user somewhere else in the document.
	// ponytail: anchored on the centre, not the pointer. Track the wheel event's
	// clientX/Y if zooming towards the cursor turns out to matter.
	useLayoutEffect(() => {
		const node = scroller.current;
		const ratio = zoom / previousZoom.current;
		previousZoom.current = zoom;
		if (!node || ratio === 1) return;
		node.scrollLeft =
			(node.scrollLeft + node.clientWidth / 2) * ratio - node.clientWidth / 2;
		node.scrollTop =
			(node.scrollTop + node.clientHeight / 2) * ratio - node.clientHeight / 2;
	}, [zoom]);

	return (
		<div ref={scroller} className="flex h-[100dvh] w-screen overflow-auto">
			<img
				src={file}
				alt="Attachment"
				onLoad={(event) => {
					const element = event.currentTarget;
					// A zero here means it has not laid out yet; leaving `fitted` null
					// keeps the CSS caps, so the image still fits — only zoom is lost.
					if (element.clientWidth > 0)
						setFitted({
							width: element.clientWidth,
							height: element.clientHeight,
						});
					onLoad();
				}}
				// Capped until it has been measured, then sized outright — the caps
				// have to come off, or they would clamp the zoom back to the viewport.
				// ponytail: the fit is not re-measured on resize or rotation; the
				// dialog is opened, read and closed. Recompute here if that changes.
				className={`m-auto rounded-md ${fitted ? "max-w-none" : "max-h-[100dvh] max-w-screen"}`}
				style={
					fitted
						? { width: fitted.width * zoom, height: fitted.height * zoom }
						: undefined
				}
			/>
			{fitted ? (
				<div className="fixed left-2.5 top-1.5 flex items-center gap-0.5 rounded-full bg-gray-100 p-1 opacity-90 shadow-lg">
					<button
						type="button"
						aria-label="Zoom out"
						disabled={zoom <= 1}
						onClick={() => zoomBy(1 / ZOOM_STEP)}
						className="rounded-full p-1.5 hover:bg-gray-300 disabled:opacity-40 md:p-2"
					>
						<Minus className="h-4 w-4" />
					</button>
					<button
						type="button"
						aria-label="Reset zoom"
						onClick={() => setZoom(1)}
						className="min-w-12 text-xs font-medium tabular-nums hover:underline"
					>
						{Math.round(zoom * 100)}%
					</button>
					<button
						type="button"
						aria-label="Zoom in"
						disabled={zoom >= MAX_ZOOM}
						onClick={() => zoomBy(ZOOM_STEP)}
						className="rounded-full p-1.5 hover:bg-gray-300 disabled:opacity-40 md:p-2"
					>
						<Plus className="h-4 w-4" />
					</button>
				</div>
			) : null}
			{placeholder}
		</div>
	);
}

/**
 * Shows a file the transaction flow handed over: a receipt PDF, a captured
 * image, an instructional video, or an arbitrary page.
 *
 * Replaces Eloka's react-player-based viewer with the native elements — the
 * only player configuration it actually used was YouTube's chrome flags, which
 * the embed URL carries directly.
 * @param props.file - URL of the file to show.
 * @param props.options - Type override and caption.
 */
export function FileViewDialog({
	file,
	options,
}: {
	file: string;
	options?: FileViewOptions;
}) {
	const [ready, setReady] = useState(false);
	const type = options?.type ?? sniffType(file);

	if (!isSafeUrl(file)) {
		return (
			<p className="p-8 text-sm text-white">This attachment can't be shown.</p>
		);
	}
	const label = options?.label || options?.header || "";
	const done = () => setReady(true);

	const placeholder = ready ? null : (
		<p className="absolute inset-0 flex items-center justify-center text-sm text-white">
			Loading…
		</p>
	);

	if (type === "image") {
		return <ImageView file={file} onLoad={done} placeholder={placeholder} />;
	}

	if (type === "audio") {
		return (
			<audio
				src={file}
				controls
				autoFocus
				onLoadedData={done}
				className="w-[80vw] max-w-lg"
			/>
		);
	}

	if (type === "video" || type === "media") {
		return (
			<video
				src={file}
				controls
				autoFocus
				onLoadedData={done}
				className="max-h-[90dvh] max-w-[90vw] rounded-md"
			/>
		);
	}

	// pdf | html | url | youtube — everything else is framed.
	return (
		<div className="relative flex h-[100dvh] w-screen flex-col">
			{label ? (
				<div className="flex h-[42px] shrink-0 items-center bg-eko-navy px-4 text-lg font-bold text-white md:h-[50px]">
					{label}
				</div>
			) : null}
			<iframe
				src={type === "youtube" ? toYouTubeEmbed(file) : file}
				title={label || "Attachment"}
				onLoad={done}
				allow="autoplay; encrypted-media; picture-in-picture"
				className="min-h-0 grow bg-white"
			/>
			{placeholder}
		</div>
	);
}
