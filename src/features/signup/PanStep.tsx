import { Callout } from "@/components/docs/Callout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useState } from "react";
import { isPersonalPan, normalizePan, PAN_PATTERN } from "./panCategory";
import type { StepProps } from "./resolveSteps";

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
			<ul className="text-muted-foreground mb-2 list-disc pl-5 text-xs">
				<li>
					If you represent a business (Pvt. Ltd., LLP, Partnership, etc.), enter
					your company's registered PAN number.
				</li>
				<li>
					If you are an individual or a Sole Proprietor, enter your personal PAN
					number.
				</li>
			</ul>

			<div className="flex flex-col gap-2">
				<Label htmlFor="pan">PAN</Label>
				<Input
					id="pan"
					value={pan}
					disabled={busy}
					autoComplete="off"
					autoCapitalize="characters"
					placeholder="ABCDE1234F"
					className="font-mono tracking-widest uppercase"
					// No `maxLength`: it truncates before this handler runs, so a
					// pasted PAN with spaces would lose its tail. `normalizePan` caps
					// the length after stripping instead.
					onChange={(e) => setPan(normalizePan(e.target.value))}
				/>
				<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<Lock className="h-3.5 w-3.5 shrink-0" />
					We use your PAN to verify your identity, as required by regulation.
				</p>
			</div>

			{/* Advisory, never blocking: a sole proprietor's personal PAN is the
			    correct answer here, so this warns and gets out of the way. The
			    submit button below is deliberately untouched by it. */}
			{isPersonalPan(pan) && (
				<Callout
					type="warning"
					className="my-0"
					label="This looks like a personal PAN"
				>
					<p className="text-sm">
						If you are signing up on behalf of a company, LLP or partnership,
						enter that entity's registered PAN instead — a personal PAN may get
						your KYC rejected later. If you are an individual or a sole
						proprietor, this is correct.
					</p>
				</Callout>
			)}

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
