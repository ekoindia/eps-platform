import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	createElement,
	useCallback,
	useEffect,
	useState,
	type ComponentType,
	type ReactNode,
} from "react";

type DialogProps = {
	spec: ApiSpec;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** One import promise per page; reset on failure so the next click retries. */
let dialogModule: Promise<{ default: ComponentType<DialogProps> }> | undefined;
const loadDialog = () => {
	dialogModule ??= import("./tryit/TryItDialog").catch((error: unknown) => {
		dialogModule = undefined;
		throw error;
	});
	return dialogModule;
};

/**
 * Wires the "Test Request" button to the lazy-loaded Try-it dialog.
 *
 * The dialog (and everything only it needs) is dynamically imported on first
 * click, so it never enters the SSR/prerender bundle and costs nothing on
 * docs pages that are only read. `?try=1` in the URL opens it on mount.
 *
 * @param spec - the endpoint; undefined (guides) yields no `onTest`, which
 *   keeps the button disabled.
 * @returns `onTest` to call from the button and the `dialog` node to render
 *   once, outside `DocsLayout`.
 */
export const useTryIt = (
	spec?: ApiSpec,
): { onTest?: () => void; dialog: ReactNode } => {
	// `?try=1` opens on load (client only; the prerender sees no window).
	const [open, setOpen] = useState(
		() =>
			Boolean(spec) &&
			typeof window !== "undefined" &&
			new URLSearchParams(window.location.search).get("try") === "1",
	);
	const [Dialog, setDialog] = useState<ComponentType<DialogProps> | null>(null);

	const load = useCallback(() => {
		loadDialog().then(
			(m) => setDialog(() => m.default),
			() => setOpen(false),
		);
	}, []);

	const onTest = useCallback(() => {
		if (typeof window === "undefined") return;
		setOpen(true);
		if (!Dialog) load();
	}, [Dialog, load]);

	// Auto-open path: the dialog chunk still has to be fetched.
	useEffect(() => {
		if (open && !Dialog) load();
	}, [open, Dialog, load]);

	const dialog =
		spec && Dialog
			? createElement(Dialog, { key: spec.id, spec, open, onOpenChange: setOpen })
			: null;

	return { onTest: spec ? onTest : undefined, dialog };
};
