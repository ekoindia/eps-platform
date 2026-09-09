import { Callout } from "@/components/docs/Callout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { useState } from "react";
import {
	isPersonalPan,
	normalizePan,
	PAN_LENGTH,
	PAN_PATTERN,
	panCategory,
	panCategoryPhrase,
} from "./panCategory";
import type { StepProps } from "./resolveSteps";

/** Who should enter which PAN. Two lines each, so the row stays scannable. */
const WHOSE_PAN: readonly { who: string; which: string }[] = [
	{ who: "Company / LLP / partnership", which: "The entity's PAN" },
	{ who: "Individual / sole proprietor", which: "Your personal PAN" },
];

/**
 * Collects and submits the user's PAN. No photo upload — the number alone is
 * verified upstream.
 *
 * Client-side validation is for feedback only; the backend re-validates.
 */
export function PanStep({ onSubmit, busy, error }: StepProps) {
	const [pan, setPan] = useState("");
	const isValid = PAN_PATTERN.test(pan);
	// Only a COMPLETE entry can be wrong. `normalizePan` caps at PAN_LENGTH, so
	// this cannot fire while the user is still typing — which is the point:
	// telling someone their half-typed PAN is invalid is just nagging.
	const isMalformed = pan.length === PAN_LENGTH && !isValid;

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (isValid && !busy) void onSubmit({ pan });
			}}
		>
			<div className="flex flex-col gap-1.5">
				<h2 className="text-2xl font-semibold tracking-tight">
					First, your PAN
				</h2>
				<p className="text-muted-foreground">
					Enter the PAN of the business or the individual signing up.
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="pan">PAN</Label>
				<Input
					id="pan"
					value={pan}
					disabled={busy}
					autoComplete="off"
					autoCapitalize="characters"
					placeholder="ABCDE1234F"
					aria-describedby="pan-status"
					aria-invalid={isMalformed || undefined}
					// `md:text-lg` is not redundant: the Input base sets `md:text-sm`,
					// and a responsive utility survives the class merge, so a bare
					// `text-lg` would be overridden from the `md` breakpoint up.
					className="h-12 font-mono text-lg tracking-widest uppercase md:text-lg"
					// No `maxLength`: it truncates before this handler runs, so a
					// pasted PAN with spaces would lose its tail. `normalizePan` caps
					// the length after stripping instead.
					onChange={(e) => setPan(normalizePan(e.target.value))}
				/>
				{/* One line, three states. `role="status"`, not `alert`: the server
				    error below is this form's alert, and a second one would both
				    fight it for attention and break every singular
				    `getByRole("alert")` query in the suite. */}
				<p
					id="pan-status"
					role="status"
					aria-live="polite"
					className={`flex items-center gap-1.5 text-sm ${
						isValid
							? "text-eko-success"
							: isMalformed
								? "text-destructive"
								: "text-muted-foreground"
					}`}
				>
					{isValid ? (
						<>
							<CheckCircle2 className="h-4 w-4 shrink-0" />
							Format looks right — {panCategoryPhrase(panCategory(pan))}.
						</>
					) : isMalformed ? (
						<>
							<XCircle className="h-4 w-4 shrink-0" />
							That doesn't look like a valid PAN.
						</>
					) : (
						<>
							<Lock className="h-3.5 w-3.5 shrink-0" />
							Encrypted, and used only for your KYC check.
						</>
					)}
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

			<hr className="border-border" />

			<div className="grid gap-4 sm:grid-cols-2 text-xs mb-4 mt-[-2px] text-muted-foreground">
				{WHOSE_PAN.map(({ who, which }) => (
					<div key={who} className="flex flex-col gap-1">
						<div className="font-semibold">{who}</div>
						<div>{which}</div>
					</div>
				))}
			</div>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<div className="flex flex-col gap-2">
				<Button type="submit" className="w-full" disabled={!isValid || busy}>
					{busy ? "Verifying…" : "Continue"}
				</Button>
				{/* Deliberately not "until step 3": the step list comes from the
				    server and the PIN step is absent for some tenants, so no fixed
				    number is true for every partner. */}
				<p className="text-center text-[0.7em] text-muted-foreground">
					Nothing is charged and no agreement is signed yet.
				</p>
			</div>
		</form>
	);
}
