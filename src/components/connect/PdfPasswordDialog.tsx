import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useRef, useState } from "react";

/** What the caller must tell the dialog about the document it is unlocking. */
export interface PdfPasswordOptions {
	/** The document's file name, so the user knows which one is being asked about. */
	fileName: string;
	/**
	 * Checks one attempt against the document.
	 *
	 * Resolves true when the password opens it, false when it does not, and
	 * rejects when the document cannot be read at all — which is not the user's
	 * fault and ends the prompt rather than blaming their typing.
	 */
	verify: (password: string) => Promise<boolean>;
}

/** The dialog's answer. `accepted: false` means no usable password. */
export interface PdfPasswordResult {
	/** The verified password. Empty unless `accepted`. */
	password: string;
	accepted: boolean;
	/** True when the document itself turned out to be unreadable. */
	unreadable?: boolean;
	[key: string]: unknown;
}

/**
 * Asks for a PDF's password, and does not close until one works.
 *
 * Verifying here rather than in the caller is what keeps a wrong guess from
 * closing and reopening the dialog, which loses focus and reads as a crash.
 *
 * The password lives in this component's state and in the single result handed
 * to the caller, which uses it once to decrypt and drops it. It is never
 * logged, never stamped into the file name, and never sent anywhere.
 *
 * @param props.options - The file name and the verifier.
 * @param props.onClose - Resolves the caller's promise.
 */
export function PdfPasswordDialog({
	options,
	onClose,
}: {
	options?: PdfPasswordOptions;
	onClose: (result: PdfPasswordResult) => void;
}) {
	const [password, setPassword] = useState("");
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		// The button is disabled while a check runs, but Enter is not.
		if (checking || !options) return;
		setChecking(true);
		setError(null);
		try {
			if (await options.verify(password)) {
				onClose({ password, accepted: true });
				return;
			}
			setError("That password didn't work. Try again.");
			inputRef.current?.select();
		} catch {
			// Not a wrong password — the file itself cannot be read. Asking again
			// would just have the user retype a password that was never the problem.
			onClose({ password: "", accepted: false, unreadable: true });
			return;
		} finally {
			setChecking(false);
		}
	}

	return (
		<form
			onSubmit={submit}
			className="w-full rounded-lg bg-background p-6 shadow-lg"
		>
			<div className="flex items-start gap-3">
				<Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
				<div className="min-w-0">
					<h2 className="font-semibold leading-tight">
						This PDF is password-protected
					</h2>
					<p className="mt-1 truncate text-sm text-muted-foreground">
						{options?.fileName}
					</p>
				</div>
			</div>

			<Label htmlFor="pdf-password" className="mt-5 block">
				Document password
			</Label>
			<Input
				id="pdf-password"
				ref={inputRef}
				type="password"
				autoFocus
				autoComplete="off"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				className="mt-1.5"
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? "pdf-password-error" : undefined}
			/>
			{error ? (
				<p
					id="pdf-password-error"
					role="alert"
					className="mt-1.5 text-sm text-destructive"
				>
					{error}
				</p>
			) : null}
			<p className="mt-2 text-xs text-muted-foreground">
				The password is used here in your browser to unlock the file, and is
				never uploaded.
			</p>

			<div className="mt-5 flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => onClose({ password: "", accepted: false })}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={checking}>
					{checking ? "Unlocking…" : "Unlock"}
				</Button>
			</div>
		</form>
	);
}
