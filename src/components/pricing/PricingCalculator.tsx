import { ApiPicker } from "@/components/pricing/ApiPicker";
import { MobileSummaryBar } from "@/components/pricing/MobileSummaryBar";
import { ADD_API_EVENT } from "@/components/pricing/PricingTable";
import { QuoteSummary } from "@/components/pricing/QuoteSummary";
import { SelectedApiRow } from "@/components/pricing/SelectedApiRow";
import { saveCalculatorContext } from "@/hooks/use-tracking-params";
import {
	DEFAULT_VOLUME,
	MAX_VOLUME,
	PRICED_APIS_MAP,
	calcQuote,
	getPricedApisForProduct,
} from "@/lib/data/api-pricing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface SelectionEntry {
	apiId: string;
	volume: number;
}

/** Clamps a parsed volume to [0, MAX_VOLUME]; falls back to DEFAULT_VOLUME */
const sanitizeVolume = (raw: number): number =>
	Number.isFinite(raw) && raw >= 0
		? Math.min(Math.round(raw), MAX_VOLUME)
		: DEFAULT_VOLUME;

/**
 * Parses the calculator selection from URL params.
 * - `sel=pan-lite:50000,gst-basic:10000` — canonical apiId:volume pairs
 * - `apis=pan` / `apis=pan-lite` — deep-link entry accepting priced-API ids
 *   OR product ids (a product id expands to all its priced APIs)
 * Unknown ids are dropped, duplicates deduped, volumes clamped.
 */
const parseSelectionFromParams = (
	params: URLSearchParams,
): SelectionEntry[] => {
	const selection: SelectionEntry[] = [];
	const seen = new Set<string>();

	const add = (apiId: string, volume: number) => {
		if (PRICED_APIS_MAP[apiId] && !seen.has(apiId)) {
			seen.add(apiId);
			selection.push({ apiId, volume: sanitizeVolume(volume) });
		}
	};

	for (const pair of (params.get("sel") ?? "").split(",")) {
		if (!pair) continue;
		const [apiId, rawVolume] = pair.split(":");
		add(apiId, Number(rawVolume));
	}

	for (const id of (params.get("apis") ?? "").split(",")) {
		if (!id) continue;
		if (PRICED_APIS_MAP[id]) {
			add(id, DEFAULT_VOLUME);
		} else {
			for (const api of getPricedApisForProduct(id)) {
				add(api.id, DEFAULT_VOLUME);
			}
		}
	}

	return selection;
};

/** Serializes the selection back into the canonical `sel` param value */
const serializeSelection = (selection: SelectionEntry[]): string =>
	selection.map(({ apiId, volume }) => `${apiId}:${volume}`).join(",");

/**
 * Interactive pricing calculator: grouped API picker, per-API volume
 * controls, and a live quote summary (sticky sidebar on desktop, bottom
 * bar + drawer on mobile). Selection state is mirrored into the URL
 * (`?sel=…&gst=1`) for shareable deep links.
 */
export const PricingCalculator = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [selection, setSelection] = useState<SelectionEntry[]>(() =>
		parseSelectionFromParams(searchParams),
	);
	const [includeGst, setIncludeGst] = useState(
		() => searchParams.get("gst") === "1",
	);
	const writeBackTimer = useRef<ReturnType<typeof setTimeout>>();

	const quote = useMemo(() => calcQuote(selection), [selection]);

	// Mirror state into the URL (debounced so slider drags don't spam history).
	// Foreign params (UTM / Google Ads / anything not ours) are preserved —
	// only the calculator's own keys are rewritten.
	useEffect(() => {
		writeBackTimer.current = setTimeout(() => {
			const serialized = serializeSelection(selection);
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					["sel", "apis", "gst"].forEach((key) => params.delete(key));
					if (selection.length > 0) params.set("sel", serialized);
					if (includeGst) params.set("gst", "1");
					return params;
				},
				{ replace: true, preventScrollReset: true },
			);
			// Persist selection for lead capture after the user leaves /pricing
			saveCalculatorContext(serialized);
		}, 300);
		return () => clearTimeout(writeBackTimer.current);
	}, [selection, includeGst, setSearchParams]);

	const addApi = (apiId: string) => {
		if (!PRICED_APIS_MAP[apiId]) return;
		setSelection((prev) =>
			prev.some((entry) => entry.apiId === apiId)
				? prev
				: [...prev, { apiId, volume: DEFAULT_VOLUME }],
		);
	};

	const toggleApi = (apiId: string) => {
		setSelection((prev) =>
			prev.some((entry) => entry.apiId === apiId)
				? prev.filter((entry) => entry.apiId !== apiId)
				: [...prev, { apiId, volume: DEFAULT_VOLUME }],
		);
	};

	const setVolume = (apiId: string, volume: number) => {
		setSelection((prev) =>
			prev.map((entry) =>
				entry.apiId === apiId ? { ...entry, volume } : entry,
			),
		);
	};

	// Rate-card "+" buttons hand off APIs via a custom window event
	useEffect(() => {
		const onAddApi = (event: Event) => {
			const { apiId } = (event as CustomEvent<{ apiId: string }>).detail ?? {};
			if (apiId) addApi(apiId);
		};
		window.addEventListener(ADD_API_EVENT, onAddApi);
		return () => window.removeEventListener(ADD_API_EVENT, onAddApi);
	}, []);

	const selectedIds = selection.map((entry) => entry.apiId);

	return (
		<div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start max-w-6xl mx-auto">
			{/* Left: picker + selected API rows */}
			<div className="min-w-0">
				<ApiPicker selectedIds={selectedIds} onToggle={toggleApi} />

				{selection.length > 0 && (
					<div className="flex flex-col gap-4 mt-6">
						{selection.map(({ apiId, volume }) => (
							<SelectedApiRow
								key={apiId}
								api={PRICED_APIS_MAP[apiId]}
								volume={volume}
								onVolumeChange={(v) => setVolume(apiId, v)}
								onRemove={() => toggleApi(apiId)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Right: sticky summary (desktop only) */}
			<aside className="hidden lg:block sticky top-24">
				<QuoteSummary
					quote={quote}
					includeGst={includeGst}
					onIncludeGstChange={setIncludeGst}
					onQuickAdd={addApi}
				/>
			</aside>

			{/* Mobile: sticky bottom bar + drawer */}
			<MobileSummaryBar
				quote={quote}
				includeGst={includeGst}
				onIncludeGstChange={setIncludeGst}
				onQuickAdd={addApi}
			/>
		</div>
	);
};
