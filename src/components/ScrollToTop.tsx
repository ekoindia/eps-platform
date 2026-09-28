import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** How long to wait for a hash target to render before giving up. */
const HASH_WAIT_MS = 2000;

export function ScrollToTop() {
	const { pathname, hash } = useLocation();

	// New page without a hash → top. Only on a pathname change: a same-page
	// query rewrite (calculators' setSearchParams, which also drops the hash)
	// must not yank the reader back up.
	const lastPathname = useRef<string | null>(null);
	useEffect(() => {
		if (pathname === lastPathname.current) return;
		lastPathname.current = pathname;
		if (!hash) window.scrollTo(0, 0);
	}, [pathname, hash]);

	// Hash → scroll to its element once it is rendered and visible. Lazy routes
	// and inactive tab panels (display:none) render it after this effect runs.
	// ponytail: rAF poll with a deadline, not a MutationObserver.
	useEffect(() => {
		if (!hash) return;
		const deadline = performance.now() + HASH_WAIT_MS;
		let frame = 0;
		const tryScroll = () => {
			const el = document.getElementById(hash.slice(1));
			if (el && el.getClientRects().length > 0) {
				el.scrollIntoView({ behavior: "smooth" });
			} else if (performance.now() < deadline) {
				frame = requestAnimationFrame(tryScroll);
			}
		};
		tryScroll();
		return () => cancelAnimationFrame(frame);
	}, [pathname, hash]);

	return null;
}
