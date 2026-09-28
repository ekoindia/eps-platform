import { ArrowRight, Zap } from "lucide-react";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { ActionCard, CardLink } from "@/lib/palette-actions/types";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

/**
 * The pinned "Suggested action" group at the top of the ⌘K results. Rendered
 * as cmdk items, so keyboard navigation reaches it and Enter on the palette's
 * first row opens the card's main action. Never acts on its own.
 * @param card - The resolved action card.
 * @param onPick - Called with the chosen link and a stable id for telemetry.
 */
export function PaletteActionCard({
	card,
	onPick,
}: {
	card: ActionCard;
	onPick: (link: CardLink, id: string) => void;
}) {
	return (
		<CommandGroup heading="Suggested action">
			<CommandItem
				value={`${card.id}:primary`}
				onSelect={() => onPick(card.primary, card.id)}
				className="items-start gap-3 py-2.5"
			>
				<Zap
					className="mt-0.5 h-4 w-4 shrink-0 text-primary"
					aria-hidden="true"
				/>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="flex items-center gap-2">
						{card.badge && HTTP_METHODS.has(card.badge) ? (
							<HttpMethodTag
								method={card.badge as "GET" | "POST" | "PUT" | "DELETE"}
							/>
						) : card.badge ? (
							<span className="rounded bg-muted px-1.5 text-[10px] font-medium uppercase text-muted-foreground">
								{card.badge}
							</span>
						) : null}
						<span className="truncate font-medium">{card.title}</span>
					</span>
					{card.detail && (
						// Current colour, dimmed: stays readable on the highlighted row,
						// where a fixed muted grey vanishes into the selection colour.
						<span className="truncate text-xs opacity-70">{card.detail}</span>
					)}
				</span>
				<span className="shrink-0 text-xs text-primary">
					{card.primary.label}
				</span>
			</CommandItem>
			{card.secondary.map((link) => (
				<CommandItem
					key={link.href}
					value={`${card.id}:${link.label}`}
					onSelect={() => onPick(link, card.id)}
					className="gap-3 pl-9 text-sm"
				>
					<ArrowRight
						className="h-3.5 w-3.5 text-muted-foreground"
						aria-hidden="true"
					/>
					{link.label}
				</CommandItem>
			))}
			{card.alternatives.map((link) => (
				<CommandItem
					key={link.href}
					value={`${card.id}:alt:${link.href}`}
					onSelect={() => onPick(link, `${card.id}:alt`)}
					className="gap-3 pl-9 text-sm text-muted-foreground"
				>
					<span className="text-xs">Or</span>
					{link.label}
				</CommandItem>
			))}
		</CommandGroup>
	);
}
