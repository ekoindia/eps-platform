import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const languages = [
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
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

export const LanguageSelector = ({ isLight = true, showLabel = false }: { isLight?: boolean; showLabel?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("en");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const ensureGoogleTranslateLoaded = (): Promise<void> => {
    return new Promise((resolve) => {
      // If already initialized, resolve immediately
      const selectEl = document.querySelector<HTMLSelectElement>(
        "#google_translate_element select"
      );
      if (selectEl) {
        resolve();
        return;
      }

      // Create hidden container for Google Translate
      let container = document.getElementById("google_translate_element");
      if (!container) {
        container = document.createElement("div");
        container.id = "google_translate_element";
        container.style.display = "none";
        document.body.appendChild(container);
      }

      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: languages.map((l) => l.code).join(","),
            layout: 0, // SIMPLE layout
            autoDisplay: false,
          },
          "google_translate_element"
        );
        // Wait briefly for the select element to render
        setTimeout(resolve, 300);
      };

      if (!document.getElementById("google-translate-script")) {
        const script = document.createElement("script");
        script.id = "google-translate-script";
        script.src =
          "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  };

  const changeLanguage = async (langCode: string) => {
    setSelected(langCode);
    setOpen(false);

    if (langCode === "en") {
      // Reset to English by removing the translate cookie and reloading
      const selectEl = document.querySelector<HTMLSelectElement>(
        "#google_translate_element select"
      );
      if (selectEl) {
        selectEl.value = langCode;
        selectEl.dispatchEvent(new Event("change"));
      }
      return;
    }

    // Lazy-load Google Translate on first non-English selection
    await ensureGoogleTranslateLoaded();

    const selectEl = document.querySelector<HTMLSelectElement>(
      "#google_translate_element select"
    );
    if (selectEl) {
      selectEl.value = langCode;
      selectEl.dispatchEvent(new Event("change"));
    }
  };

  const selectedLang = languages.find((l) => l.code === selected);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer rounded-md px-2 py-1.5 hover:bg-white/10",
          isLight ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
        )}
        aria-label="Select language"
      >
        <Globe className="w-4 h-4" />
        <span className={showLabel ? undefined : "hidden sm:inline"}>{selectedLang?.label || "English"}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-border/50 py-2 z-[60] max-h-80 overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-muted transition-colors cursor-pointer",
                selected === lang.code
                  ? "text-eko-navy font-semibold bg-muted/50"
                  : "text-eko-slate"
              )}
            >
              {lang.label}
              {selected === lang.code && <Check className="w-4 h-4 text-eko-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
