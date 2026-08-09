/**
 * On-device sharpness scoring for document captures.
 *
 * The metric is tile-based variance of a 3×3 Laplacian: blur suppresses the
 * second derivative everywhere, so a low variance means no sharp edges
 * anywhere. Scoring per tile and taking a high percentile means a document
 * with *any* crisp region passes — a form that is half signature and half
 * blank refuses to be judged by its blank half.
 *
 * Every score is normalized to 0–100 (higher = sharper) so thresholds in
 * config are human-tweakable and independent of image resolution. The math is
 * pure (arrays in, number out) so it unit-tests without a canvas; the DOM
 * wrappers below feed it and fail open — `null` always means "could not
 * judge", never "blurry".
 */

/** What a blur check may do with its verdict. */
export type BlurCheckMode = "off" | "measure" | "warn" | "block";

/**
 * Default floor on the 0–100 sharpness scale.
 *
 * ponytail: a paper value, not a calibrated one. Every KYC document currently
 * runs in `measure` mode to collect real `blur_scoreN` telemetry; calibrate
 * against that distribution before flipping any doc type to `warn`/`block`.
 */
export const DEFAULT_BLUR_THRESHOLD = 30;

/** Longest side, in pixels, at which images are analysed. */
export const BLUR_ANALYSIS_MAX_LENGTH = 1024;

/** Tiles per side of the analysis grid. */
const TILE_GRID = 8;
/** Which tile's variance becomes the score — p90 ≈ "the sharpest region". */
const TILE_PERCENTILE = 0.9;
/** Tiles with less luma spread than this (0–255) carry no ink to judge. */
const MIN_TILE_STDDEV = 4;
/** Below this many judgeable tiles the image is essentially blank. */
const MIN_USABLE_TILES = 4;

/** Knobs for {@link blurScore}; defaults suit ~1024px document captures. */
export interface BlurScoreOptions {
	/** Tiles per side. Default 8. */
	grid?: number;
	/** Percentile of per-tile variances used as the score, 0–1. Default 0.9. */
	percentile?: number;
}

/**
 * Collapses RGBA bytes to Rec.601 luma.
 *
 * @param rgba - Pixel bytes as `ImageData.data` lays them out.
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns One 0–255 luma value per pixel.
 */
export function toGrayscale(
	rgba: Uint8ClampedArray,
	width: number,
	height: number,
): Float32Array {
	const luma = new Float32Array(width * height);
	for (let pixel = 0; pixel < luma.length; pixel += 1) {
		const offset = pixel * 4;
		luma[pixel] =
			0.299 * rgba[offset] +
			0.587 * rgba[offset + 1] +
			0.114 * rgba[offset + 2];
	}
	return luma;
}

/**
 * Sharpness of a grayscale image, normalized to 0–100.
 *
 * @param gray - 0–255 luma values, row-major.
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @param options - Grid size and percentile; see {@link BlurScoreOptions}.
 * @returns 0–100 (higher = sharper), or null when the image is too blank to
 * judge — which callers must treat as "pass", not "blurry".
 */
export function blurScore(
	gray: Float32Array,
	width: number,
	height: number,
	options: BlurScoreOptions = {},
): number | null {
	const { grid = TILE_GRID, percentile = TILE_PERCENTILE } = options;
	if (width < 3 || height < 3) return null;

	const variances: number[] = [];
	for (let tileY = 0; tileY < grid; tileY += 1) {
		const y0 = Math.floor((height * tileY) / grid);
		const y1 = Math.floor((height * (tileY + 1)) / grid);
		for (let tileX = 0; tileX < grid; tileX += 1) {
			const x0 = Math.floor((width * tileX) / grid);
			const x1 = Math.floor((width * (tileX + 1)) / grid);

			let lumaSum = 0;
			let lumaSquares = 0;
			let lumaCount = 0;
			let lapSum = 0;
			let lapSquares = 0;
			let lapCount = 0;

			for (let y = y0; y < y1; y += 1) {
				for (let x = x0; x < x1; x += 1) {
					const index = y * width + x;
					const value = gray[index];
					lumaSum += value;
					lumaSquares += value * value;
					lumaCount += 1;

					// The kernel needs all four neighbours, so the image border
					// contributes luma statistics but no Laplacian sample.
					if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;
					const response =
						gray[index - width] +
						gray[index + width] +
						gray[index - 1] +
						gray[index + 1] -
						4 * value;
					lapSum += response;
					lapSquares += response * response;
					lapCount += 1;
				}
			}

			if (lumaCount === 0 || lapCount < 4) continue;
			const lumaMean = lumaSum / lumaCount;
			const lumaVariance = lumaSquares / lumaCount - lumaMean * lumaMean;
			// A tile with no ink has nothing to be sharp about; judging it would
			// read every blank margin as blur.
			if (Math.sqrt(Math.max(0, lumaVariance)) < MIN_TILE_STDDEV) continue;

			const lapMean = lapSum / lapCount;
			variances.push(Math.max(0, lapSquares / lapCount - lapMean * lapMean));
		}
	}

	if (variances.length < MIN_USABLE_TILES) return null;
	variances.sort((a, b) => a - b);
	const picked =
		variances[
			Math.min(
				variances.length - 1,
				Math.floor(percentile * (variances.length - 1)),
			)
		];
	// Laplacian variance spans ~1 (heavy blur) to ~10⁴ (crisp print), so the
	// 0–100 scale is logarithmic: crisp scans land ~60–80, soft focus ~10–30.
	return Math.max(0, Math.min(100, Math.round(20 * Math.log10(1 + picked))));
}

/** A source-pixel region to analyse, e.g. the crop the user selected. */
export interface BlurRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Scores a drawable source, downscaling to the analysis resolution first.
 *
 * @param source - Anything `drawImage` accepts, e.g. a loaded `<img>`.
 * @param sourceWidth - The source's natural width in pixels.
 * @param sourceHeight - The source's natural height in pixels.
 * @param region - Sub-rectangle to analyse, in natural pixels. Whole image
 * when absent.
 * @param options - Passed through to {@link blurScore}.
 * @returns The 0–100 score, or null when it cannot be computed — fail open.
 */
export function blurScoreFromSource(
	source: CanvasImageSource,
	sourceWidth: number,
	sourceHeight: number,
	region?: BlurRegion,
	options?: BlurScoreOptions,
): number | null {
	if (typeof document === "undefined") return null;
	const sx = region?.x ?? 0;
	const sy = region?.y ?? 0;
	const sw = region?.width ?? sourceWidth;
	const sh = region?.height ?? sourceHeight;
	if (!(sw > 0) || !(sh > 0)) return null;

	const scale = Math.min(1, BLUR_ANALYSIS_MAX_LENGTH / Math.max(sw, sh));
	const width = Math.max(1, Math.round(sw * scale));
	const height = Math.max(1, Math.round(sh * scale));

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	try {
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) return null;
		context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
		const { data } = context.getImageData(0, 0, width, height);
		return blurScore(toGrayscale(data, width, height), width, height, options);
	} catch {
		// Tainted canvas, decode failure — we cannot judge, so we do not block.
		return null;
	} finally {
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Scores an image file the editor never sees (`disableImageConfirm` paths).
 *
 * @param file - A picked or captured image.
 * @param options - Passed through to {@link blurScore}.
 * @returns The 0–100 score, or null when the image cannot be decoded.
 */
export async function blurScoreFromImageFile(
	file: Blob,
	options?: BlurScoreOptions,
): Promise<number | null> {
	if (typeof document === "undefined") return null;
	const url = URL.createObjectURL(file);
	try {
		const element = await new Promise<HTMLImageElement>((resolve, reject) => {
			const loaded = new Image();
			loaded.onload = () => resolve(loaded);
			loaded.onerror = () => reject(new Error("Could not decode that image."));
			loaded.src = url;
		});
		return blurScoreFromSource(
			element,
			element.naturalWidth,
			element.naturalHeight,
			undefined,
			options,
		);
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Scores travel from check time (editor accept, file pick) to submit time
 * (`KycUploadDialog`) on the `File` object itself, keyed weakly so nothing
 * leaks and no prop signature changes. A file rebuilt along the way —
 * compressed, combined — must be re-stamped by whoever rebuilt it.
 */
const scoresByFile = new WeakMap<File, number>();

/** Records a file's sharpness score for later telemetry. */
export function setBlurScore(file: File, score: number): void {
	scoresByFile.set(file, score);
}

/** The score recorded for a file, if it was ever scored. */
export function getBlurScore(file: File): number | undefined {
	return scoresByFile.get(file);
}
