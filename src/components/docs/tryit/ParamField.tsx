import type { ResolvedApiParam } from "@/lib/data/api-specs-common";
import { coerceValue, isPlainObject } from "@/lib/docs/tryit-request";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

export const fieldInput =
	"w-full rounded-md border border-[var(--rp-line)] bg-[var(--rp-code)] px-2.5 py-1.5 font-mono text-xs text-[var(--rp-fg)] placeholder:text-[var(--rp-ln)] focus:border-[var(--rp-acc)] focus:outline-none focus:ring-2 focus:ring-[var(--rp-accline)]";

const fieldLabel =
	"flex items-baseline gap-1.5 font-mono text-xs font-semibold text-[var(--rp-fg)]";

interface ParamFieldProps {
	param: ResolvedApiParam;
	value: unknown;
	error?: string;
	/** Typed value for the wire; `undefined` removes the key. */
	onChange: (value: unknown) => void;
	/** Per-field draft error (object/array editors) — blocks Send while set. */
	onError?: (error: string | null) => void;
	onFile?: (file: File | null) => void;
	/** Rendered after the label (e.g. the auto-ref checkbox). */
	trailing?: ReactNode;
}

const idFor = (name: string) => `tryit-${name}`;

/** JSON textarea for object/array params: keeps its own draft so the cursor
 * never jumps, commits typed values when valid, reports errors otherwise. */
const JsonField = ({
	param,
	value,
	onChange,
	onError,
}: Pick<ParamFieldProps, "param" | "value" | "onChange" | "onError">) => {
	const [draft, setDraft] = useState(() =>
		value === undefined ? "" : JSON.stringify(value, null, 2),
	);
	return (
		<textarea
			id={idFor(param.name)}
			rows={4}
			value={draft}
			spellCheck={false}
			className={cn(fieldInput, "resize-y")}
			onChange={(e) => {
				const text = e.target.value;
				setDraft(text);
				if (text.trim() === "") {
					onChange(undefined);
					onError?.(null);
					return;
				}
				try {
					const parsed: unknown = JSON.parse(text);
					const okShape =
						param.type === "array"
							? Array.isArray(parsed)
							: isPlainObject(parsed);
					if (!okShape) throw new Error(`Must be a JSON ${param.type}`);
					onChange(parsed);
					onError?.(null);
				} catch (err) {
					onError?.(err instanceof Error ? err.message : "Invalid JSON");
				}
			}}
		/>
	);
};

/**
 * One labelled request field, shaped by the spec param: enum → select,
 * file → file input, number → numeric input (blank omits the key), boolean →
 * checkbox, object/array → JSON textarea, else text. Required marker,
 * description and inline validation error included.
 */
export const ParamField = ({
	param,
	value,
	error,
	onChange,
	onError,
	onFile,
	trailing,
}: ParamFieldProps) => {
	const id = idFor(param.name);
	const str = value == null ? "" : String(value);
	let control: ReactNode;
	if (param.type === "file") {
		control = (
			<input
				id={id}
				type="file"
				className={cn(
					fieldInput,
					"cursor-pointer file:mr-2 file:rounded file:border-0 file:bg-[var(--rp-accbg)] file:px-2 file:py-0.5 file:text-[var(--rp-acc)]",
				)}
				onChange={(e) => onFile?.(e.target.files?.[0] ?? null)}
			/>
		);
	} else if (param.enum) {
		control = (
			<select
				id={id}
				value={str}
				className={fieldInput}
				onChange={(e) => onChange(coerceValue(param, e.target.value))}
			>
				<option value="">—</option>
				{param.enum.map((opt) => (
					<option key={String(opt)} value={String(opt)}>
						{String(opt)}
					</option>
				))}
			</select>
		);
	} else if (param.type === "boolean") {
		control = (
			<input
				id={id}
				type="checkbox"
				checked={value === true}
				className="h-4 w-4 accent-[var(--rp-acc)]"
				onChange={(e) => onChange(e.target.checked)}
			/>
		);
	} else if (param.type === "object" || param.type === "array") {
		control = (
			<JsonField
				param={param}
				value={value}
				onChange={onChange}
				onError={onError}
			/>
		);
	} else {
		const numeric = param.type === "number" || param.type === "integer";
		control = (
			<input
				id={id}
				type={numeric ? "number" : "text"}
				inputMode={numeric ? "decimal" : undefined}
				min={param.min}
				max={param.max}
				step={param.type === "integer" ? 1 : undefined}
				value={str}
				placeholder={param.example == null ? undefined : String(param.example)}
				className={fieldInput}
				onChange={(e) => onChange(coerceValue(param, e.target.value))}
			/>
		);
	}

	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2">
				<label htmlFor={id} className={fieldLabel}>
					{param.name}
					{param.required && (
						<span className="text-[0.625rem] font-medium uppercase tracking-wide text-[var(--rp-acc)]">
							required
						</span>
					)}
					<span className="text-[0.625rem] font-normal text-[var(--rp-fg3)]">
						{param.type}
					</span>
				</label>
				{trailing}
			</div>
			{control}
			{error ? (
				<p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
			) : (
				param.description && (
					<p className="line-clamp-2 text-xs text-[var(--rp-fg3)]">
						{param.description}
					</p>
				)
			)}
		</div>
	);
};
