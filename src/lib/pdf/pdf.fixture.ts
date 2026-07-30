/**
 * Test fixtures for the PDF toolkit.
 *
 * Two tiny JPEGs, one portrait and one landscape, so page-orientation logic
 * has something real to embed. Inlined as base64 rather than kept as binary
 * files so the tests stay self-contained and the repo stays text-only.
 */

/** 40×60 solid red JPEG. */
const PORTRAIT_JPEG_BASE64 =
	"/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAA8ACgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAUG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AhAJzYgAAAAAAAAAAAAAAAAAAAAAP/9k=";

/** 60×40 solid blue JPEG. */
const LANDSCAPE_JPEG_BASE64 =
	"/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAoADwDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAQG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AjgGxTgAAAAAAAAAAAAAAAAAAAAAP/9k=";

/**
 * Decodes a base64 string to bytes, without Node's `Buffer` so the fixture
 * works in the jsdom environment the suite runs in.
 *
 * @param base64 - The encoded data.
 * @returns The decoded bytes.
 */
function decode(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

/** 40×60 JPEG bytes. */
export const portraitJpeg = (): Uint8Array => decode(PORTRAIT_JPEG_BASE64);

/** 60×40 JPEG bytes. */
export const landscapeJpeg = (): Uint8Array => decode(LANDSCAPE_JPEG_BASE64);
