import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, authClient } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	type ClipboardEvent,
	type KeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";

const OTP_LENGTH = 6;

/** Extracts a human-readable error string from an ApiError or unknown thrown value. */
function message(e: unknown): string {
	return e instanceof ApiError ? e.message : "Network error. Please try again.";
}

/** Masks all but the last 4 digits of a mobile number for confirmation display. */
function maskMobile(mobile: string): string {
	return "•".repeat(Math.max(0, mobile.length - 4)) + mobile.slice(-4);
}

const RESEND_COOLDOWN_SEC = 30;

/** Two-step OTP login form: collect mobile → send OTP → verify OTP → call onSuccess. */
export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
	const { refresh } = useAuth();
	const [step, setStep] = useState<"mobile" | "otp">("mobile");
	const [mobile, setMobile] = useState("");
	const [digits, setDigits] = useState<string[]>(() =>
		Array(OTP_LENGTH).fill(""),
	);
	const otp = digits.join("");
	const boxesRef = useRef<Array<HTMLInputElement | null>>([]);
	const lastSubmittedRef = useRef<string>("");
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
			await authClient.startOtp(mobile);
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
			await authClient.verifyOtp(mobile, otp);
			await refresh();
			onSuccess?.();
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{step === "mobile" ? (
				<div className="flex flex-col gap-2">
					<Label htmlFor="login-mobile">Mobile number</Label>
					<Input
						id="login-mobile"
						inputMode="numeric"
						autoComplete="tel"
						value={mobile}
						onChange={(e) => setMobile(e.target.value)}
						placeholder="10-digit mobile"
					/>
					<Button onClick={sendOtp} disabled={busy || mobile.length < 10}>
						{busy ? "Sending…" : "Send OTP"}
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
								onPaste={i === 0 ? handleOtpPaste : undefined}
								className="h-12 w-10 text-center text-lg"
							/>
						))}
					</div>
					<Button onClick={verify} disabled={busy || otp.length < OTP_LENGTH}>
						{busy ? "Verifying…" : "Verify & sign in"}
					</Button>
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
							disabled={busy}
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
							disabled={busy || cooldown > 0}
						>
							{cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
						</button>
					</div>
				</div>
			)}
			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
