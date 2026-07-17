import { ApiError, authClient } from "@/lib/auth/client";
import { cn, formatINR } from "@/lib/utils";
import { RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Seconds a manual refresh stays disabled, mirroring Eloka's StatusCard. The
 * balance moves only when the user transacts, so the cooldown costs them
 * nothing and keeps a jittery click well inside the backend's rate limit.
 */
const REFRESH_COOLDOWN_MS = 30_000;

type Status = "loading" | "ok" | "error" | "hidden";

/**
 * The signed-in developer's E-value balance, pinned to the top of the console
 * rail. Renders nothing at all when the account has no wallet (the backend
 * answers 403) — an empty card would just raise a question it can't answer.
 */
export function WalletBalance() {
	const [status, setStatus] = useState<Status>("loading");
	const [balance, setBalance] = useState<number | null>(null);
	const [cooling, setCooling] = useState(false);
	const [busy, setBusy] = useState(true);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mounted = useRef(true);

	const load = useCallback(async () => {
		setBusy(true);
		try {
			const view = await authClient.walletBalance();
			if (!mounted.current) return;
			setBalance(view.balance);
			setStatus("ok");
		} catch (e) {
			if (!mounted.current) return;
			// 403 is the definitive "no wallet on this account" answer, not a
			// transient failure — hide for good rather than offering a retry that
			// can only fail the same way. Every other failure keeps the card, so a
			// blip stays retryable.
			if (e instanceof ApiError && e.httpStatus === 403) setStatus("hidden");
			else setStatus("error");
		} finally {
			if (mounted.current) setBusy(false);
		}
	}, []);

	useEffect(() => {
		void load();
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
