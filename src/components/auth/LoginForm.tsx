import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, authClient } from "@/lib/auth/client";
import {
	type ClipboardEvent,
	type KeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

const OTP_LENGTH = 4;

/** Extracts a human-readable error string from an ApiError or unknown thrown value. */
function message(e: unknown): string {
	return e instanceof ApiError ? e.message : "Network error. Please try again.";
}

/** Masks all but the last 4 digits of a mobile number for confirmation display. */
function maskMobile(mobile: string): string {
	return "•".repeat(Math.max(0, mobile.length - 4)) + mobile.slice(-4);
}

const RESEND_COOLDOWN_SEC = 30;

/**
 * localStorage key holding the last mobile number that passed OTP verification,
 * so returning developers don't retype it. Stored as raw 10 digits.
 */
const LAST_MOBILE_KEY = "eko-last-mobile";

/**
 * Two-step OTP login form: collect mobile → send OTP → verify OTP → call onSuccess.
 *
 * @param onSuccess - Called once the session has been adopted.
 * @param prefetch - Optional warm-up for whatever renders after a successful
 *   login, fired when the OTP step appears. Typically a bare `import()` of the
 *   next lazy route. The caller supplies it rather than this component naming a
 *   page, because the two call sites go to different places: the console lands
 *   on the dashboard, `/signup` on the wizard.
 * @param submitLabel - Label for the mobile-step submit button. Defaults to
 *   "Send OTP"; the sign-in split names the whole method instead, because there
 *   it is the page's only call to action rather than one control on a card.
 */
export function LoginForm({
	onSuccess,
	prefetch,
	submitLabel = "Send OTP",
}: {
	onSuccess?: () => void;
	prefetch?: () => Promise<unknown>;
	submitLabel?: string;
}) {
	const { adopt } = useAuth();
	const [step, setStep] = useState<"mobile" | "otp">("mobile");
	const [mobile, setMobile] = useState("");
	const [digits, setDigits] = useState<string[]>(() =>
		Array(OTP_LENGTH).fill(""),
	);
	const otp = digits.join("");
	const boxesRef = useRef<Array<HTMLInputElement | null>>([]);
	const lastSubmittedRef = useRef<string>("");
	const prefetchedRef = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	/** Resets all OTP boxes and clears the auto-submit guard. */
	function resetOtp() {
		setDigits(Array(OTP_LENGTH).fill(""));
		lastSubmittedRef.current = "";
	}

	function focusBox(i: number) {
		boxesRef.current[i]?.focus();
	}

	/** Writes a single digit box and advances focus to the next box. */
	function handleDigit(index: number, raw: string) {
		const cleaned = raw.replace(/\D/g, "");
		setDigits((prev) => {
			const next = [...prev];
			next[index] = cleaned.slice(-1);
			return next;
		});
		if (cleaned && index < OTP_LENGTH - 1) focusBox(index + 1);
	}

	/** Backspace on an empty box steps focus to the previous box. */
	function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && !digits[index] && index > 0) {
			focusBox(index - 1);
		}
	}

	/** Distributes a pasted code across the boxes. */
	function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
		const text = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, OTP_LENGTH);
		if (!text) return;
		e.preventDefault();
		setDigits(Array.from({ length: OTP_LENGTH }, (_, i) => text[i] ?? ""));
		focusBox(Math.min(text.length, OTP_LENGTH - 1));
	}

	// Prefill the mobile field: a `?mobile=` link wins over the last verified
	// number, because a link that carries a number was aimed at this visitor.
	// Read after mount (never during SSR / pre-render, so the server's empty
	// field hydrates cleanly), and only into a still-empty field so a fast
	// typist is never clobbered.
	useEffect(() => {
		// Strip and take the last 10 digits, the same rule the Input's paste
		// handler uses, so "+91 (999) 000-0001" and "09990000001" both land as
		// "9990000001".
		const fromUrl = new URLSearchParams(window.location.search)
			.get("mobile")
			?.replace(/\D/g, "")
			.slice(-10);
		if (fromUrl && /^\d{10}$/.test(fromUrl)) {
			setMobile((cur) => cur || fromUrl);
			return;
		}
		try {
			const saved = localStorage.getItem(LAST_MOBILE_KEY);
			if (saved && /^\d{10}$/.test(saved)) setMobile((cur) => cur || saved);
		} catch {
			/* ignore */
		}
	}, []);

	// Warm the next route's chunk while the user is reading the SMS. That is
	// several idle seconds on the one navigation that cannot start until they
	// finish typing, so the download is free — and without it the chunk request
	// only begins after the session lands, adding a round-trip to a screen the
	// user is already waiting on. Once per mount; a failure is silent, because a
	// prefetch that fails must never fail a login (the real import retries).
	useEffect(() => {
		if (step !== "otp" || prefetchedRef.current || !prefetch) return;
		prefetchedRef.current = true;
		void prefetch()?.catch(() => {});
	}, [step, prefetch]);

	// Tick the resend countdown down to zero, one second at a time.
	useEffect(() => {
		if (cooldown <= 0) return;
		const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(t);
	}, [cooldown]);

	// Auto-submit once all boxes are filled; the ref guard prevents re-submitting
	// the same code (e.g. after a failed verify leaves the boxes full).
	useEffect(() => {
		if (
			step === "otp" &&
			otp.length === OTP_LENGTH &&
			!busy &&
			lastSubmittedRef.current !== otp
		) {
			lastSubmittedRef.current = otp;
			void verify();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step, otp, busy]);

	async function sendOtp() {
		setBusy(true);
		setError(null);
		try {
			const { otp: demoOtp } = await authClient.startOtp(mobile);
			// dev/UAT backends echo the OTP so testers don't need the SMS.
			if (demoOtp) toast.info(`Demo OTP: ${demoOtp}`, { duration: 6000 });
			setStep("otp");
			setCooldown(RESEND_COOLDOWN_SEC);
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}

	async function verify() {
		setBusy(true);
		setError(null);
		try {
			const me = await authClient.verifyOtp(mobile, otp);
			// OTP passed — whether this ends in a session or an onboarding wizard,
			// the number is worth remembering for the next login.
			try {
				localStorage.setItem(LAST_MOBILE_KEY, mobile);
			} catch {
				/* ignore */
			}
			// The verify response IS the /me view. Adopting it saves a round-trip
			// and a second upstream profile lookup on the one path where the user
			// is watching a spinner.
			adopt(me);
			onSuccess?.();
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		// A real <form> so the browser's own implicit submission handles Enter:
		// on either step, Enter activates the (validity-gated) submit button.
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (busy) return;
				if (step === "mobile") {
					if (mobile.length >= 10) void sendOtp();
				} else if (otp.length === OTP_LENGTH) {
					void verify();
				}
			}}
		>
			{/* Native disabled fieldset switches off every input and button inside
			    while a request is in flight — no per-control busy wiring needed. */}
			<fieldset disabled={busy} className="flex flex-col gap-4">
				{step === "mobile" ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="login-mobile">Mobile number</Label>
						<Input
							id="login-mobile"
							autoComplete="tel"
							prefix="+91"
							digitGroups={[3, 3, 4]}
							value={mobile}
							onChange={(e) => setMobile(e.target.value)}
							placeholder="10-digit mobile"
						/>
						<Button
							type="submit"
							disabled={busy || mobile.length < 10}
							className="mt-4"
						>
							{busy ? "Sending…" : submitLabel}
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<Label htmlFor="login-otp">Enter OTP</Label>
						<p className="text-sm text-muted-foreground">
							Code sent to {maskMobile(mobile)}
						</p>
						<div className="flex gap-2" role="group" aria-label="One-time code">
							{digits.map((d, i) => (
								<Input
									key={i}
									id={i === 0 ? "login-otp" : undefined}
									ref={(el) => {
										boxesRef.current[i] = el;
									}}
									inputMode="numeric"
									autoComplete={i === 0 ? "one-time-code" : "off"}
									aria-label={`Digit ${i + 1}`}
									maxLength={1}
									autoFocus={i === 0}
									value={d}
									onChange={(e) => handleDigit(i, e.target.value)}
									onKeyDown={(e) => handleOtpKeyDown(i, e)}
									onPaste={handleOtpPaste}
									className="h-12 w-10 text-center text-lg"
								/>
							))}
						</div>
						<Button
							type="submit"
							disabled={busy || otp.length < OTP_LENGTH}
							className="mt-4"
						>
							{busy ? "Verifying…" : "Verify & sign in"}
						</Button>
						{/* Redundant while a code is already being verified — hide, don't
					    just disable, so the user isn't offered retry paths mid-flight. */}
						{!busy && (
							<div className="flex items-center justify-between">
								<button
									type="button"
									className="text-xs text-muted-foreground underline self-start disabled:opacity-50"
									onClick={() => {
										setStep("mobile");
										resetOtp();
										setError(null);
										setCooldown(0);
									}}
								>
									Use a different number
								</button>
								<button
									type="button"
									className="text-sm text-muted-foreground hover:underline self-start disabled:opacity-50"
									onClick={() => {
										resetOtp();
										setError(null);
										void sendOtp();
									}}
									disabled={cooldown > 0}
								>
									{cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
								</button>
							</div>
						)}
					</div>
				)}
				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
			</fieldset>
		</form>
	);
}
