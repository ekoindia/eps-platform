import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepProps } from "./resolveSteps";

/** Indian PAN: five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PAN_LENGTH = 10;

/**
 * Collects and submits the user's PAN. No photo upload — the number alone is
 * verified upstream.
 *
 * Client-side validation is for feedback only; the backend re-validates.
 */
export function PanStep({ onSubmit, busy, error }: StepProps) {
	const [pan, setPan] = useState("");
	const isValid = PAN_PATTERN.test(pan);

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (isValid && !busy) void onSubmit({ pan });
			}}
		>
			<p className="text-muted-foreground">
				Enter your PAN number to continue.
			</p>

			<div className="flex flex-col gap-2">
				<Label htmlFor="pan">PAN</Label>
				<Input
					id="pan"
					value={pan}
					disabled={busy}
					autoComplete="off"
					autoCapitalize="characters"
					maxLength={PAN_LENGTH}
					placeholder="ABCDE1234F"
					className="font-mono tracking-widest uppercase"
					onChange={(e) => setPan(e.target.value.toUpperCase())}
				/>
				<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<Lock className="h-3.5 w-3.5 shrink-0" />
					We use your PAN to verify your identity, as required by regulation.
				</p>
			</div>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!isValid || busy}>
				{busy ? "Verifying…" : "Continue"}
			</Button>
		</form>
	);
}
