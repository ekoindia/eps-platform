import { LANGUAGES, useLanguage } from "@/lib/google-translate";
import { cn } from "@/lib/utils";
import { Check, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The standalone language button: a globe that opens a list.
 *
 * The Translate wiring lives in `@/lib/google-translate`, shared with the
 * account menu's language submenu — a signed-in header moves the control in
 * there, and both must agree about the current language.
 */
export const LanguageSelector = ({
	isLight = true,
	showLabel = false,
	placement = "bottom-right",
}: {
	isLight?: boolean;
	showLabel?: boolean;
	/**
	 * Where the menu opens relative to the trigger. Default `bottom-right`
	 * (header, top of page). Use `top-left` when anchored near the viewport
	 * bottom-left, e.g. the mobile drawer footer, so the menu stays on-screen.
	 */
	placement?: "bottom-right" | "top-left";
}) => {
	const [open, setOpen] = useState(false);
	const { selected, changeLanguage } = useLanguage();
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const selectedLang = LANGUAGES.find((l) => l.code === selected);

	return (
		<div className="relative notranslate" ref={dropdownRef}>
			<button
				onClick={() => setOpen(!open)}
				className={cn(
					"flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer rounded-md px-2 py-1.5 hover:bg-white/10",
					isLight
						? "text-white/90 hover:text-white"
						: "text-eko-slate hover:text-eko-navy",
				)}
				aria-label="Select language"
				title="Select language"
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<Globe className="w-4 h-4" />
				{showLabel && <span>{selectedLang?.label || "English"}</span>}
			</button>

			{open && (
				<div
					className={cn(
						"absolute w-48 bg-white rounded-xl shadow-xl border border-border/50 py-2 z-[60] max-h-80 overflow-y-auto",
						placement === "top-left"
							? "bottom-full left-0 mb-2"
							: "top-full right-0 mt-2",
					)}
				>
					{LANGUAGES.map((lang) => (
						<button
							key={lang.code}
							onClick={() => {
								setOpen(false);
								void changeLanguage(lang.code);
							}}
							className={cn(
								"w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-muted transition-colors cursor-pointer",
								selected === lang.code
									? "text-eko-navy font-semibold bg-muted/50"
									: "text-eko-slate",
							)}
						>
							{lang.label}
							{selected === lang.code && (
								<Check className="w-4 h-4 text-eko-gold" />
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
};
