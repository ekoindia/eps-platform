import type { CSSProperties } from "react";
import type { Picture as PictureMetadata } from "imagetools-core";

export type PictureSource = string | PictureMetadata;

interface PictureProps {
	/** Plain URL (e.g. an SVG import) or an imagetools `?as=picture` object. */
	src: PictureSource;
	alt: string;
	className?: string;
	sizes?: string;
	loading?: "lazy" | "eager";
	fetchPriority?: "high" | "low" | "auto";
	width?: number;
	height?: number;
	style?: CSSProperties;
	id?: string;
}

/**
 * Renders a responsive `<picture>` for imagetools metadata (multi-format,
 * multi-width srcset), or a plain `<img>` when given a string URL (SVGs).
 * The `<picture>` uses `display: contents` so it is layout-transparent and
 * the inner `<img>` keeps the call site's className/flex behaviour.
 */
export const Picture = ({
	src,
	alt,
	className,
	sizes,
	loading,
	fetchPriority,
	width,
	height,
	style,
	id,
}: PictureProps) => {
	if (typeof src === "string") {
		return (
			<img
				src={src}
				alt={alt}
				className={className}
				sizes={sizes}
				loading={loading}
				fetchPriority={fetchPriority}
				width={width}
				height={height}
				style={style}
				id={id}
			/>
		);
	}

	return (
		<picture style={{ display: "contents" }}>
			{Object.entries(src.sources).map(([format, srcset]) => (
				<source
					key={format}
					type={`image/${format}`}
					srcSet={srcset}
					sizes={sizes}
				/>
			))}
			<img
				src={src.img.src}
				alt={alt}
				className={className}
				sizes={sizes}
				loading={loading}
				fetchPriority={fetchPriority}
				width={width ?? src.img.w}
				height={height ?? src.img.h}
				style={style}
				id={id}
			/>
		</picture>
	);
};

export default Picture;
