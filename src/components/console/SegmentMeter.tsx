import type { ProfileStrength } from "@/lib/console/profile-fields";
import { cn } from "@/lib/utils";

/**
 * "Profile strength" as one segment per profile field, for the navy identity
 * cards: gold for filled, a pulsing gold outline for the one being asked now,
 * faint for the rest.
 * @param strength - From `useProfileFields`.
 * @param next - Outline the first empty segment: a question for it is showing.
 */
export function SegmentMeter({
	strength,
	next = false,
}: {
	strength: ProfileStrength;
	next?: boolean;
}) {
	const { filled, total, percent } = strength;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between text-xs">
				<span className="text-white/80">Profile strength</span>
				<span className="font-semibold tabular-nums text-white">
					{percent}%
				</span>
			</div>
			<div
				className="flex gap-1"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Profile strength"
			>
				{Array.from({ length: total }, (_, i) => (
					<div
						key={i}
						className={cn(
							"h-1.5 flex-1 rounded-full",
							i < filled
								? "bg-eko-gold"
								: next && i === filled
									? "border-[1.5px] border-eko-gold motion-safe:animate-pulse"
									: "bg-white/15",
						)}
					/>
				))}
			</div>
		</div>
	);
}
