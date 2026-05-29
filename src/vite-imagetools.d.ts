// Type the imagetools `?...&as=picture` import suffix as a Picture object
// instead of the default `string`. Plain (unsuffixed) image imports keep
// Vite's built-in `string` typing from `vite/client`.
declare module "*&as=picture" {
	const value: import("imagetools-core").Picture;
	export default value;
}
