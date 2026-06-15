import { useEffect, useState, useRef } from "react";

export type ScrollDirection = "up" | "down";

interface UseScrollDirectionOptions {
	/** Minimum px delta before direction flips. Prevents jitter. Default 8. */
	threshold?: number;
}

interface ScrollState {
	direction: ScrollDirection;
	y: number;
}

/**
 * Tracks vertical scroll direction and current scroll position.
 *
 * Uses passive scroll listener + rAF batching to avoid layout thrash.
 * Direction only flips after `threshold` px of movement in the opposite
 * direction, debouncing micro-scrolls.
 */
export function useScrollDirection(
	options: UseScrollDirectionOptions = {},
): ScrollState {
	const { threshold = 8 } = options;
	const [state, setState] = useState<ScrollState>({
		direction: "up",
		y: typeof window === "undefined" ? 0 : window.scrollY,
	});
	const lastYRef = useRef<number>(
		typeof window === "undefined" ? 0 : window.scrollY,
	);
	const tickingRef = useRef<boolean>(false);

	useEffect(() => {
		const update = () => {
			const currentY = window.scrollY;
			const lastY = lastYRef.current;
			const delta = currentY - lastY;

			if (Math.abs(delta) >= threshold) {
				const direction: ScrollDirection = delta > 0 ? "down" : "up";
				lastYRef.current = currentY;
				setState((prev) =>
					prev.direction === direction && prev.y === currentY
						? prev
						: { direction, y: currentY },
				);
			} else {
				setState((prev) =>
					prev.y === currentY ? prev : { ...prev, y: currentY },
				);
			}
			tickingRef.current = false;
		};

		const onScroll = () => {
			if (!tickingRef.current) {
				window.requestAnimationFrame(update);
				tickingRef.current = true;
			}
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);

	return state;
}
