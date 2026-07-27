import { useState } from "react";

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
 * Sniffs the content type from the file extension.
 * @param file - The file URL.
 * @returns The matching type, defaulting to `html` so an extension-less URL is
 *   framed as a page rather than refused.
 */
function sniffType(file: string): FileViewType {
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
	const label = options?.label || options?.header || "";
	const done = () => setReady(true);

	const placeholder = ready ? null : (
		<p className="absolute inset-0 flex items-center justify-center text-sm text-white">
			Loading…
		</p>
	);

	if (type === "image") {
		return (
			<div className="relative">
				<img
					src={file}
					alt="Attachment"
					onLoad={done}
					className="max-h-[90vh] max-w-[90vw] rounded-md"
				/>
				{placeholder}
			</div>
		);
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
				className="max-h-[90vh] max-w-[90vw] rounded-md"
			/>
		);
	}

	// pdf | html | url | youtube — everything else is framed.
	return (
		<div className="relative flex h-screen w-screen flex-col">
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
