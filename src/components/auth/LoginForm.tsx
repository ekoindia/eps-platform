import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, authClient } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEffect, useState } from "react";

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
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	// Tick the resend countdown down to zero, one second at a time.
	useEffect(() => {
		if (cooldown <= 0) return;
		const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(t);
	}, [cooldown]);

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
					<Input
						id="login-otp"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						autoFocus
						value={otp}
						onChange={(e) => setOtp(e.target.value)}
						placeholder="6-digit code"
					/>
					<Button onClick={verify} disabled={busy || otp.length < 4}>
						{busy ? "Verifying…" : "Verify & sign in"}
					</Button>
					<div className="flex items-center justify-between">
						<button
							type="button"
							className="text-xs text-muted-foreground underline self-start disabled:opacity-50"
							onClick={() => {
								setStep("mobile");
								setOtp("");
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
								setOtp("");
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
