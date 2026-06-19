import { codeBlockTheme } from "@/lib/code-block-theme";
import { cn } from "@/lib/utils";
import { Highlight } from "prism-react-renderer";
import { useCallback, useEffect, useRef } from "react";

interface CodeBlockProps {
	code: string;
	language?: string;
	fileName?: string;
	className?: string;
	/**
	 * "glass" — translucent frosted look + pointer-follow 3D tilt; only suits a
	 * dark backdrop (e.g. the hero). "solid" (default) — opaque dark card, no
	 * tilt; safe over any background.
	 */
	variant?: "glass" | "solid";
}

/** Max degrees the card rotates toward the cursor on either axis. */
const TILT_DEG = 8;

export const CodeBlock = ({
	code,
	language = "javascript",
	fileName,
	className,
	variant = "solid",
}: CodeBlockProps) => {
	const src = code.replace(/\n$/, "");
	const lines = src.split("\n");
	const isGlass = variant === "glass";

	const cardRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number | null>(null);
	// Whether the pointer-follow tilt is allowed (glass + hover-capable + motion-OK).
	const tiltEnabled = useRef(false);

	// Resolve interaction capability once, and keep it in sync with preference
	// changes. SSR-safe: matchMedia only touched in the browser via useEffect.
	useEffect(() => {
		if (!isGlass || typeof window === "undefined" || !window.matchMedia) return;
		const hover = window.matchMedia("(hover: hover)");
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			tiltEnabled.current = hover.matches && !reduce.matches;
		};
		update();
		hover.addEventListener("change", update);
		reduce.addEventListener("change", update);
		return () => {
			hover.removeEventListener("change", update);
			reduce.removeEventListener("change", update);
		};
	}, [isGlass]);

	// Cancel any pending frame on unmount so we never write to a detached node.
	useEffect(
		() => () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		},
		[],
	);

	const handlePointerMove = useCallback((e: React.PointerEvent) => {
		const el = cardRef.current;
		if (!el || !tiltEnabled.current) return;
		const { left, top, width, height } = el.getBoundingClientRect();
		const x = (e.clientX - left) / width; // 0..1
		const y = (e.clientY - top) / height; // 0..1
		if (rafRef.current !== null) return; // a frame is already queued
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;
			// Write CSS vars only — the transform itself lives in CSS so it
			// composes with the eased reset transition.
			el.style.setProperty("--cb-rx", `${(0.5 - y) * TILT_DEG}deg`);
			el.style.setProperty("--cb-ry", `${(x - 0.5) * TILT_DEG}deg`);
			el.style.setProperty("--cb-mx", `${x * 100}%`);
			el.style.setProperty("--cb-my", `${y * 100}%`);
			el.style.setProperty("--cb-glare", "1");
		});
	}, []);

	const handlePointerLeave = useCallback(() => {
		const el = cardRef.current;
		if (!el) return;
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		el.style.setProperty("--cb-rx", "0deg");
		el.style.setProperty("--cb-ry", "0deg");
		el.style.setProperty("--cb-glare", "0");
	}, []);

	return (
		<div
			ref={cardRef}
			onPointerMove={isGlass ? handlePointerMove : undefined}
			onPointerLeave={isGlass ? handlePointerLeave : undefined}
			className={cn(
				"code-block group",
				isGlass ? "code-block--glass" : "code-block--solid",
				className,
			)}
		>
			<div className="code-header">
				<div className="flex gap-1.5">
					<div className="code-dot bg-destructive/80" />
					<div className="code-dot bg-primary" />
					<div className="code-dot bg-eko-success" />
				</div>
				{fileName ? (
					<span className="ml-4 text-xs text-white/50 font-mono">
						{fileName}
					</span>
				) : (
					<span className="ml-4 text-xs text-white/40 font-mono uppercase tracking-wide">
						{language}
					</span>
				)}
			</div>

			{/* Specular glare — glass only; sits above glass, below code text. */}
			{isGlass && <div className="code-glare" aria-hidden />}

			<div className="code-body docs-scroll relative flex overflow-x-auto text-[0.8rem] lg:text-[0.85rem]">
				<div
					aria-hidden
					className="code-gutter sticky left-0 z-10 select-none py-4 pl-3 pr-3 text-right font-mono text-[0.7rem] leading-[1.5rem] text-white/30"
				>
					{lines.map((_, i) => (
						<div key={i}>{i + 1}</div>
					))}
				</div>
				<Highlight theme={codeBlockTheme} code={src} language={language}>
					{({ tokens, getLineProps, getTokenProps }) => (
						<pre className="min-w-0 flex-1 py-4 pl-4 pr-4 lg:pr-6 font-mono leading-[1.5rem] whitespace-pre">
							{tokens.map((line, i) => (
								<div key={i} {...getLineProps({ line })}>
									{line.map((token, key) => (
										<span key={key} {...getTokenProps({ token })} />
									))}
								</div>
							))}
						</pre>
					)}
				</Highlight>
			</div>
		</div>
	);
};

export const exampleApiCode = `// Initialize Eko API Client
const eko = new EkoAPI({
  apiKey: process.env.EKO_API_KEY
});

// Verify PAN Card
const verification = await eko.verify.pan({
  panNumber: "ABCDE1234F",
  fullName: "John Doe"
});

console.log(verification.status); // "verified"
console.log(verification.details);`;

export const examplePaymentCode = `// Create DMT Transfer
const transfer = await eko.payments.dmt({
  beneficiaryAccount: "1234567890",
  ifscCode: "HDFC0001234",
  amount: 5000,
  senderMobile: "9876543210"
});

// Check transfer status
const status = await eko.payments.status(
  transfer.transactionId
);`;

export const exampleIntegrationSteps = [
	{
		step: 1,
		title: "Sign Up",
		description:
			"Create your developer account and access the sandbox environment",
	},
	{
		step: 2,
		title: "Get API Keys",
		description: "Generate your API keys from the developer dashboard",
	},
	{
		step: 3,
		title: "Start Integrating",
		description: "Use our SDKs and comprehensive docs to build your solution",
	},
];
