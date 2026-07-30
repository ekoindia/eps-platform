import { useEffect, useState } from "react";

/** A fix, or the reason there isn't one. */
export interface GeolocationState {
	latitude: number | null;
	longitude: number | null;
	/** Radius of confidence in metres. */
	accuracy: number | null;
	error: string | null;
}

const IDLE: GeolocationState = {
	latitude: null,
	longitude: null,
	accuracy: null,
	error: null,
};

/**
 * The device's current position, requested once.
 *
 * `enabled` exists because asking is not free: the browser shows a permission
 * prompt and, once granted, high accuracy wakes the GPS. Nothing is requested
 * until a caller actually needs a fix.
 * @param enabled - Whether to ask for a position at all.
 * @param highAccuracy - Prefer GPS over a network estimate.
 * @returns The fix, or an error string once the attempt fails.
 */
export function useGeolocation(
	enabled: boolean,
	highAccuracy = true,
): GeolocationState {
	const [state, setState] = useState<GeolocationState>(IDLE);

	useEffect(() => {
		if (!enabled) return;
		if (!("geolocation" in navigator)) {
			setState({ ...IDLE, error: "Geolocation unavailable" });
			return;
		}

		let live = true;
		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (!live) return;
				setState({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracy: position.coords.accuracy,
					error: null,
				});
			},
			(error) => {
				if (live) setState({ ...IDLE, error: error.message });
			},
			{ enableHighAccuracy: highAccuracy, timeout: 15_000, maximumAge: 60_000 },
		);

		return () => {
			live = false;
		};
	}, [enabled, highAccuracy]);

	return state;
}
