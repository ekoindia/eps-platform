import { useState } from "react";

/**
 * Google Translate wiring, shared by the header's standalone language button and
 * the account menu's language submenu.
 *
 * Extracted from `LanguageSelector` when the signed-in header moved the control
 * into `UserMenu`: two renderers, one script loader and one selection, or the
 * two would each load Translate and disagree about the current language.
 */

/** The languages offered, in the order they are listed. */
export const LANGUAGES = [
	{ code: "en", label: "English" },
	{ code: "hi", label: "हिन्दी" },
	{ code: "bn", label: "বাংলা" },
	{ code: "te", label: "తెలుగు" },
	{ code: "mr", label: "मराठी" },
	{ code: "ta", label: "தமிழ்" },
	{ code: "gu", label: "ગુજરાતી" },
	{ code: "kn", label: "ಕನ್ನಡ" },
	{ code: "ml", label: "മലയാളം" },
	{ code: "pa", label: "ਪੰਜਾਬੀ" },
	{ code: "or", label: "ଓଡ଼ିଆ" },
	{ code: "as", label: "অসমীয়া" },
	{ code: "ur", label: "اردو" },
] as const;

declare global {
	interface Window {
		google?: {
			translate: {
				TranslateElement: new (
					config: Record<string, unknown>,
					id: string,
				) => void;
			};
		};
		googleTranslateElementInit?: () => void;
	}
}

/** The hidden element Google Translate drives, and the script that creates it. */
const CONTAINER_ID = "google_translate_element";
const SCRIPT_ID = "google-translate-script";

/** The language `<select>` Translate injects, once it exists. */
function translateSelect(): HTMLSelectElement | null {
	return document.querySelector<HTMLSelectElement>(`#${CONTAINER_ID} select`);
}

/**
 * Loads Google Translate on first use, and resolves once its `<select>` exists.
 *
 * Lazy deliberately: most visitors read the site in English, and the script is a
 * third-party request that would otherwise be on every page load.
 */
function ensureGoogleTranslateLoaded(): Promise<void> {
	return new Promise((resolve) => {
		if (translateSelect()) {
			resolve();
			return;
		}

		let container = document.getElementById(CONTAINER_ID);
		if (!container) {
			container = document.createElement("div");
			container.id = CONTAINER_ID;
			container.style.display = "none";
			document.body.appendChild(container);
		}

		window.googleTranslateElementInit = () => {
			new window.google!.translate.TranslateElement(
				{
					pageLanguage: "en",
					includedLanguages: LANGUAGES.map((language) => language.code).join(
						",",
					),
					layout: 0, // SIMPLE
					autoDisplay: false,
				},
				CONTAINER_ID,
			);
			// The select renders a beat after init; there is no callback for it.
			setTimeout(resolve, 300);
		};

		if (!document.getElementById(SCRIPT_ID)) {
			const script = document.createElement("script");
			script.id = SCRIPT_ID;
			script.src =
				"//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
			script.defer = true;
			document.head.appendChild(script);
		}
	});
}

/**
 * The selected language and a setter that drives Google Translate.
 * @returns The current code and a `changeLanguage(code)` action.
 */
export function useLanguage(): {
	selected: string;
	changeLanguage: (code: string) => Promise<void>;
} {
	const [selected, setSelected] = useState("en");

	const changeLanguage = async (code: string) => {
		setSelected(code);

		// Back to English: Translate is already loaded if anything was translated,
		// and if it never loaded there is nothing to undo.
		if (code !== "en") await ensureGoogleTranslateLoaded();

		const select = translateSelect();
		if (!select) return;
		select.value = code;
		select.dispatchEvent(new Event("change"));
	};

	return { selected, changeLanguage };
}
