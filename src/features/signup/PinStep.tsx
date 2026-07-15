import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import type { StepProps } from "./resolveSteps";

const PIN_LENGTH = 4;

/** Renders one masked PIN field. */
function PinField({
	id,
	label,
	value,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	disabled: boolean;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<InputOTP
				id={id}
				aria-label={label}
				maxLength={PIN_LENGTH}
				value={value}
				disabled={disabled}
				onChange={onChange}
			>
				<InputOTPGroup>
					{Array.from({ length: PIN_LENGTH }, (_, i) => (
						<InputOTPSlot key={i} index={i} mask />
					))}
				</InputOTPGroup>
			</InputOTP>
		</div>
	);
}

/**
 * Collects a 4-digit secret PIN and its confirmation.
 *
 * The PIN is sent to our backend, which encodes it against a single-use
 * pintwin key before submitting upstream — no encoding happens here.
 */
export function PinStep({ onSubmit, busy, error }: StepProps) {
	const [pin1, setPin1] = useState("");
	const [pin2, setPin2] = useState("");

	const complete = pin1.length === PIN_LENGTH && pin2.length === PIN_LENGTH;
	const matches = pin1 === pin2;
	const canSubmit = complete && matches && !busy;

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				if (canSubmit) void onSubmit([pin1, pin2]);
			}}
		>
			<p className="text-muted-foreground">
				Choose a 4-digit PIN. You'll use it to authorize transactions.
			</p>

			<PinField
				id="pin1"
				label="Secret PIN"
				value={pin1}
				disabled={busy}
				onChange={setPin1}
			/>
			<PinField
				id="pin2"
				label="Confirm PIN"
				value={pin2}
				disabled={busy}
				onChange={setPin2}
			/>

			{complete && !matches && (
				<p className="text-sm text-destructive">The PINs do not match.</p>
			)}

			<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Lock className="h-3.5 w-3.5 shrink-0" />
				Never share your PIN. Eko will never ask for it.
			</p>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!canSubmit}>
				{busy ? "Setting your PIN…" : "Finish"}
			</Button>
		</form>
	);
}
