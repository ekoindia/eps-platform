import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Root one-time-code input. Pass `maxLength` and `value`/`onChange`. */
const InputOTP = React.forwardRef<
	React.ElementRef<typeof OTPInput>,
	React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
	<OTPInput
		ref={ref}
		containerClassName={cn(
			"flex items-center gap-2 has-[:disabled]:opacity-50",
			containerClassName,
		)}
		className={cn("disabled:cursor-not-allowed", className)}
		{...props}
	/>
));
InputOTP.displayName = "InputOTP";

/** Groups slots into one visual field. */
const InputOTPGroup = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

/** One character cell. Renders a dot instead of the character when `mask` is set. */
const InputOTPSlot = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div"> & { index: number; mask?: boolean }
>(({ index, mask, className, ...props }, ref) => {
	const inputOTPContext = React.useContext(OTPInputContext);
	const slot = inputOTPContext.slots[index];
	const char = slot?.char;
	const hasFakeCaret = slot?.hasFakeCaret;
	const isActive = slot?.isActive;

	return (
		<div
			ref={ref}
			className={cn(
				"relative flex h-12 w-12 items-center justify-center rounded-md border border-input text-lg transition-all",
				isActive && "z-10 ring-2 ring-ring ring-offset-background",
				className,
			)}
			{...props}
		>
			{char !== null && char !== undefined && (mask ? "•" : char)}
			{hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
				</div>
			)}
		</div>
	);
});
InputOTPSlot.displayName = "InputOTPSlot";

export { InputOTP, InputOTPGroup, InputOTPSlot };
