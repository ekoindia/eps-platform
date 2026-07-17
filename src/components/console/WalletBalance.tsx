import { cn, formatINR } from "@/lib/utils";
import {
	fetchWalletBalance,
	freshWalletBalance,
	FRESH_FOR_MS,
} from "@/lib/wallet-balance";
import { RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Seconds a manual refresh stays disabled, mirroring Eloka's StatusCard. The
 * balance moves only when the user transacts, so the cooldown costs them
 * nothing and keeps a jittery click well inside the backend's rate limit. Same
 * window the cache treats a balance as fresh for — one fetch, one lockout.
 */
const REFRESH_COOLDOWN_MS = FRESH_FOR_MS;

type Status = "loading" | "ok" | "error" | "hidden";

/**
 * The signed-in developer's E-value balance, pinned to the top of the console
 * rail. Renders nothing at all when the account has no wallet (the backend
 * answers 403) — an empty card would just raise a question it can't answer.
 */
export function WalletBalance() {
	// A fresh cache paints the real balance on the first frame, so a console
	// navigation no longer flashes "Loading…" at an answer we already have.
	const seed = freshWalletBalance();
	const [status, setStatus] = useState<Status>(seed?.status ?? "loading");
	const [balance, setBalance] = useState<number | null>(seed?.balance ?? null);
	// A remount used to hand back a fully armed refresh button, letting a user who
	// hops pages click past the rate limit the cooldown exists to respect. Any
	// fetch this recent counts, so the button starts locked for the remainder.
	const [cooling, setCooling] = useState(!!seed);
	const [busy, setBusy] = useState(!seed);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mounted = useRef(true);

	const load = useCallback(async () => {
		setBusy(true);
		try {
			const settled = await fetchWalletBalance();
			if (!mounted.current) return;
			// 403 is the definitive "no wallet on this account" answer, not a
			// transient failure — fetchWalletBalance settles it to "hidden" rather
			// than offering a retry that can only fail the same way.
			setBalance(settled.balance);
			setStatus(settled.status);
		} catch {
			// Every other failure keeps the card, so a blip stays retryable.
			if (mounted.current) setStatus("error");
		} finally {
			if (mounted.current) setBusy(false);
		}
	}, []);

	useEffect(() => {
		if (!seed) {
			void load();
			return;
		}
		// Seeded, so the button started locked — release it when the cached
		// balance's own cooldown runs out, not on a fresh 30s that a remount would
		// otherwise restart. Without this nothing ever unlocks it: only refresh()
		// arms that timer.
		const left = REFRESH_COOLDOWN_MS - (Date.now() - seed.at);
		timer.current = setTimeout(() => setCooling(false), left);
		// `seed` is read once at mount; `load` is stable. Re-running on a changed
		// `seed` would refetch mid-life, which is what this card is avoiding.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [load]);

	// A cooldown or an in-flight request outliving its component would otherwise
	// set state on an unmounted one.
	useEffect(
		() => () => {
			mounted.current = false;
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const refresh = () => {
		// `busy` is the real guard, not just cosmetic: a request slower than the
		// cooldown would otherwise let a second one start, and whichever lands last
		// wins — which can be the older, staler answer.
		if (cooling || busy) return;
		setCooling(true);
		timer.current = setTimeout(() => setCooling(false), REFRESH_COOLDOWN_MS);
		void load();
	};

	if (status === "hidden") return null;

	return (
		<div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-eko-navy px-4 py-3">
			<div className="flex min-w-0 items-center gap-2.5">
				<Wallet className="h-6 w-6 shrink-0 text-white/60" aria-hidden="true" />
				<div className="min-w-0">
					<div className="text-[11px] leading-tight text-white/70">
						E-value Balance
					</div>
					<div className="truncate text-base font-semibold leading-tight text-eko-gold">
						{status === "ok" && balance !== null ? (
							formatINR(balance)
						) : status === "error" ? (
							<span className="text-sm font-normal text-white/70">
								Couldn't load
							</span>
						) : (
							<span className="text-sm font-normal text-white/70">
								Loading…
							</span>
						)}
					</div>
				</div>
			</div>
			<button
				type="button"
				onClick={refresh}
				disabled={cooling || busy}
				aria-label="Refresh E-value balance"
				className={cn(
					"grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-eko-navy transition-opacity",
					cooling || busy
						? "cursor-not-allowed opacity-30"
						: "cursor-pointer hover:opacity-90",
				)}
			>
				<RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
			</button>
		</div>
	);
}
