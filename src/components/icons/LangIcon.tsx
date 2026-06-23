import type { SampleLang } from "@/lib/docs/code-samples";
import { Terminal } from "lucide-react";
import {
	DiDotnet,
	DiGo,
	DiJava,
	DiNodejsSmall,
	DiPhp,
	DiPython,
} from "react-icons/di";

/**
 * Languages we render an icon for. Today's code samples cover {@link SampleLang}
 * (curl/javascript/python/php); the rest are the planned SDK targets — Java,
 * C#/.NET and Go — wired up ahead of time so a tab "just works" the moment its
 * sample/SDK ships.
 */
export type LangId = SampleLang | "java" | "csharp" | "go";

/**
 * Tech/brand glyph for a code-sample language, tinted via `currentColor` so it
 * adapts to the surrounding tab/pill text colour. cURL has no brand logo, so it
 * falls back to a generic terminal icon. Node.js stands in for `javascript`
 * since every JS sample on the site targets Node.
 */
export const LangIcon = ({
	id,
	className,
}: {
	id: LangId;
	className?: string;
}) => {
	switch (id) {
		case "javascript":
			return <DiNodejsSmall className={className} aria-hidden />;
		case "python":
			return <DiPython className={className} aria-hidden />;
		case "php":
			return <DiPhp className={className} aria-hidden />;
		case "java":
			return <DiJava className={className} aria-hidden />;
		case "csharp":
			return <DiDotnet className={className} aria-hidden />;
		case "go":
			return <DiGo className={className} aria-hidden />;
		case "curl":
			return <Terminal className={className} aria-hidden />;
	}
};
