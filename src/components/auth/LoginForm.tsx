import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, authClient } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useState } from "react";

function message(e: unknown): string {
	return e instanceof ApiError ? e.message : "Network error. Please try again.";
}

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
	const { refresh } = useAuth();
	const [step, setStep] = useState<"mobile" | "otp">("mobile");
	const [mobile, setMobile] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function sendOtp() {
		setBusy(true);
		setError(null);
		try {
			await authClient.startOtp(mobile);
			setStep("otp");
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
					<Input
						id="login-otp"
						inputMode="numeric"
						autoComplete="one-time-code"
						value={otp}
						onChange={(e) => setOtp(e.target.value)}
						placeholder="OTP sent to your mobile"
					/>
					<Button onClick={verify} disabled={busy || otp.length === 0}>
						{busy ? "Verifying…" : "Verify & sign in"}
					</Button>
					<button
						type="button"
						className="text-sm text-muted-foreground hover:underline self-start"
						onClick={sendOtp}
						disabled={busy}
					>
						Resend OTP
					</button>
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
