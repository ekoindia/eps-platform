import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	BUSINESS_FIELDS,
	BUSINESS_GROUPS,
	type BusinessField,
	validateField,
} from "./businessFields";
import type { StepProps } from "./resolveSteps";

/** Looks up a field's spec by name. */
const specOf = (name: string): BusinessField =>
	BUSINESS_FIELDS.find((f) => f.name === name) as BusinessField;

/** Every field starts empty, including the optional ones. */
const emptyValues = (): Record<string, string> =>
	Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.name, ""]));

/**
 * Collects company, contact, and registered-address details for onboarding.
 *
 * The form is generated from `BUSINESS_FIELDS`, so a field is declared once and
 * both rendered and validated from that one entry. Client validation is for
 * feedback only — the BFF re-checks every field before calling upstream.
 */
export function BusinessStep({ onSubmit, busy, error }: StepProps) {
	const [values, setValues] = useState<Record<string, string>>(emptyValues);
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	const set = (name: string, value: string) =>
		setValues((prev) => ({ ...prev, [name]: value }));

	const errorFor = (field: BusinessField): string | null =>
		touched[field.name] ? validateField(field, values[field.name]) : null;

	const canSubmit =
		!busy && BUSINESS_FIELDS.every((f) => !validateField(f, values[f.name]));

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(e) => {
				e.preventDefault();
				if (!canSubmit) return;
				const trimmed = Object.fromEntries(
					BUSINESS_FIELDS.map((f) => [f.name, values[f.name].trim()]),
				);
				void onSubmit(trimmed);
			}}
		>
			<p className="text-muted-foreground">
				Tell us about your business. This appears on your agreement and
				invoices.
			</p>

			{BUSINESS_GROUPS.map((group) => (
				<fieldset key={group.heading} className="flex flex-col gap-4">
					<legend className="text-sm font-medium text-foreground">
						{group.heading}
					</legend>
					{group.fields.map((name) => {
						const field = specOf(name);
						const fieldError = errorFor(field);
						return (
							<div key={name} className="flex flex-col gap-2">
								<Label htmlFor={name}>{field.label}</Label>
								{field.kind === "select" ? (
									<select
										id={name}
										value={values[name]}
										disabled={busy}
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
										aria-invalid={fieldError ? true : undefined}
										aria-describedby={fieldError ? `${name}-error` : undefined}
										onChange={(e) => set(name, e.target.value)}
										onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
									>
										<option value="">Select…</option>
										{field.options?.map((o) => (
											<option key={o.value} value={o.value}>
												{o.label}
											</option>
										))}
									</select>
								) : (
									<Input
										id={name}
										value={values[name]}
										disabled={busy}
										maxLength={field.max}
										placeholder={field.placeholder}
										inputMode={field.numeric ? "numeric" : undefined}
										autoComplete="off"
										aria-invalid={fieldError ? true : undefined}
										aria-describedby={fieldError ? `${name}-error` : undefined}
										onChange={(e) => set(name, e.target.value)}
										onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
									/>
								)}
								{fieldError && (
									<p id={`${name}-error`} className="text-sm text-destructive">
										{fieldError}
									</p>
								)}
							</div>
						);
					})}
				</fieldset>
			))}

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!canSubmit}>
				{busy ? "Saving…" : "Continue"}
			</Button>
		</form>
	);
}
