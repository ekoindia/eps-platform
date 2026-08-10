/**
 * On-device sharpness scoring for document captures.
 *
 * The metric is tile-based variance of a 3×3 Laplacian: blur suppresses the
 * second derivative everywhere, so a low variance means no sharp edges
 * anywhere. The image is split into tiles, tiles with no ink are dropped, and
 * a LOW percentile of what remains becomes the score — the document is only
 * as legible as its worst inked region.
 *
 * Every score is normalized to 0–100 (higher = sharper) so thresholds in
 * config are human-tweakable and independent of image resolution. The math is
 * pure (arrays in, number out) so it unit-tests without a canvas; the DOM
 * wrappers below feed it and fail open — `null` always means "could not
 * judge", never "blurry".
 *
 * Rough calibration against synthetic text pages at analysis resolution:
 * a crisp page scores ~80, one soft edge or a mild defocus ~45–60, visibly
 * blurred ~15, unreadable below 10. See `docs/features/kyc-documents.md` for
 * the measurements and for what this metric does *not* catch.
 */

/** What a blur check may do with its verdict. */
export type BlurCheckMode = "off" | "measure" | "warn" | "block";

/**
 * Default floor on the 0–100 sharpness scale.
 *
 * ponytail: fitted to synthetic text pages, not to real captures — it is the
 * only cut that separated every "should pass" case from every "should fail"
 * one, but the margin was 3 points (46 vs 43), which is tight. Re-fit against
 * real `blur_scoreN` telemetry before moving KYC from `warn` to `block`.
 */
export const DEFAULT_BLUR_THRESHOLD = 45;

/** Longest side, in pixels, at which images are analysed. */
export const BLUR_ANALYSIS_MAX_LENGTH = 1024;

/** Tiles per side of the analysis grid. */
const TILE_GRID = 8;
/**
 * Which tile's variance becomes the score, as a percentile over the inked
 * tiles. p10 ≈ "one of the worst inked regions".
 *
 * Low, not high. A high percentile reads only the sharpest patch, which makes
 * the metric blind to the most common phone-camera failure there is: a page
 * shot at an angle, crisp at the near edge and unreadable at the far one. Such
 * a capture measured 85 at p90 — indistinguishable from a perfect scan — and
 * 43 at p10. The blank-tile guard below is what makes a low percentile safe;
 * without it, empty margins would decide every verdict.
 */
const TILE_PERCENTILE = 0.1;
/** Tiles with less luma spread than this (0–255) carry no ink to judge. */
const MIN_TILE_STDDEV = 4;
/** Below this many judgeable tiles the image is essentially blank. */
const MIN_USABLE_TILES = 4;

/** Knobs for {@link blurScore}; defaults suit ~1024px document captures. */
export interface BlurScoreOptions {
	/** Tiles per side. Default 8. */
	grid?: number;
	/**
	 * Percentile of per-tile variances used as the score, 0–1. Default 0.1.
	 * See {@link TILE_PERCENTILE} for why it is low.
	 */
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

/**
 * Scores an image file, downscaling to the analysis resolution first.
 *
 * Always fed the bytes that will actually be uploaded — after any crop,
 * resize and re-encode. Scoring the original instead would fail decent
 * captures: a soft 4000px phone photo resized to 1200px is genuinely legible,
 * because the blur kernel shrinks below a pixel on the way down, and it is the
 * resized file the reviewer opens.
 *
 * @param file - The image as it will be uploaded.
 * @param options - Passed through to {@link blurScore}.
 * @returns The 0–100 score, or null when the image cannot be judged.
 */
export async function blurScoreFromImageFile(
	file: Blob,
	options?: BlurScoreOptions,
): Promise<number | null> {
	if (typeof document === "undefined") return null;
	const url = URL.createObjectURL(file);
	const canvas = document.createElement("canvas");
	try {
		const element = await new Promise<HTMLImageElement>((resolve, reject) => {
			const loaded = new Image();
			loaded.onload = () => resolve(loaded);
			loaded.onerror = () => reject(new Error("Could not decode that image."));
			loaded.src = url;
		});

		const { naturalWidth: sourceWidth, naturalHeight: sourceHeight } = element;
		if (!(sourceWidth > 0) || !(sourceHeight > 0)) return null;
		const scale = Math.min(
			1,
			BLUR_ANALYSIS_MAX_LENGTH / Math.max(sourceWidth, sourceHeight),
		);
		const width = Math.max(1, Math.round(sourceWidth * scale));
		const height = Math.max(1, Math.round(sourceHeight * scale));

		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) return null;
		context.drawImage(element, 0, 0, width, height);
		const { data } = context.getImageData(0, 0, width, height);
		return blurScore(toGrayscale(data, width, height), width, height, options);
	} catch {
		// Undecodable, tainted canvas — we cannot judge, so we do not block.
		return null;
	} finally {
		URL.revokeObjectURL(url);
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Longest side for scoring live preview frames. Smaller than the upload
 * analysis size on purpose: the loop runs several times a second, and at
 * 320px a frame costs well under a millisecond — cheap enough for a phone
 * that is simultaneously encoding the preview.
 */
const LIVE_ANALYSIS_MAX_LENGTH = 320;

// One canvas reused across the whole preview loop, not one per frame — at a
// few frames a second, per-call canvases are pure GC churn.
// ponytail: module-level singleton; fine while only one camera can be open.
let liveFrameCanvas: HTMLCanvasElement | null = null;

/**
 * Scores one frame of a live camera preview.
 *
 * The viewfinder companion to {@link blurScoreFromImageFile}: same metric,
 * smaller frame, built for a loop. Lets the UI say "hold steady" *before* the
 * shot instead of rejecting the photo after.
 *
 * The absolute value reads slightly lower than the same scene scored at
 * upload resolution — compare trends and thresholds, not exact numbers.
 *
 * @param video - The `<video>` element playing the preview.
 * @returns The 0–100 score, or null while there is no frame to judge.
 */
export function blurScoreFromVideo(video: HTMLVideoElement): number | null {
	if (typeof document === "undefined") return null;
	if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
		return null;
	}

	const scale = Math.min(
		1,
		LIVE_ANALYSIS_MAX_LENGTH / Math.max(video.videoWidth, video.videoHeight),
	);
	const width = Math.max(1, Math.round(video.videoWidth * scale));
	const height = Math.max(1, Math.round(video.videoHeight * scale));

	try {
		liveFrameCanvas ??= document.createElement("canvas");
		if (liveFrameCanvas.width !== width) liveFrameCanvas.width = width;
		if (liveFrameCanvas.height !== height) liveFrameCanvas.height = height;
		const context = liveFrameCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!context) return null;
		context.drawImage(video, 0, 0, width, height);
		const { data } = context.getImageData(0, 0, width, height);
		return blurScore(toGrayscale(data, width, height), width, height);
	} catch {
		return null;
	}
}

/**
 * Writes a sharpness score into a file name, before the extension.
 *
 * The reviewer opening `aadhaar-front_blur_score18.pdf` can see at a glance
 * that the scan was soft. A stopgap with a purpose: upstream stores the file
 * name but not our `blur_scoreN` form fields, so until it records them the
 * name is the only channel that reaches review.
 *
 * @param fileName - The name as it would otherwise be uploaded.
 * @param score - The 0–100 score to record.
 * @returns The name with `_blur_score<n>` inserted before the extension.
 */
export function withBlurScoreInName(fileName: string, score: number): string {
	const suffix = `_blur_score${score}`;
	const dot = fileName.lastIndexOf(".");
	// `dot <= 0` covers both "no extension" and a leading-dot name, where
	// everything after the dot is the stem rather than a suffix.
	if (dot <= 0) return `${fileName}${suffix}`;
	return `${fileName.slice(0, dot)}${suffix}${fileName.slice(dot)}`;
}

/**
 * The score for something made of several images or pages: the lowest.
 *
 * Not the average. Review reads every page, so a three-page pack whose middle
 * page is unreadable is rejected however crisp the other two are — averaging
 * would hide exactly the page that gets it bounced. The same rule holds for
 * PDF pages and for the images combined into one.
 *
 * @param scores - Per-page or per-image scores; `null`/absent ones are ignored.
 * @returns The worst score, or null when nothing could be judged.
 */
export function lowestBlurScore(
	scores: Array<number | null | undefined>,
): number | null {
	const judged = scores.filter(
		(score): score is number => typeof score === "number",
	);
	return judged.length > 0 ? Math.min(...judged) : null;
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
