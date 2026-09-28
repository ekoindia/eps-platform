import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Command, CommandList } from "@/components/ui/command";
import type { ActionCard } from "@/lib/palette-actions/types";
import { PaletteActionCard } from "./PaletteActionCard";

const card: ActionCard = {
	intent: "find_api",
	id: "action:find_api:bbps-fetch-bill",
	title: "Fetch BBPS Bill",
	detail: "/customer/payment/bbps/bill",
	badge: "GET",
	primary: { label: "Open API docs", href: "/docs/bbps-fetch-bill" },
	secondary: [{ label: "Try it", href: "/docs/bbps-fetch-bill?try=1" }],
	alternatives: [{ label: "Pay BBPS Bill", href: "/docs/bbps-pay-bill" }],
};

// cmdk scrolls the active item into view; jsdom has no layout to scroll.
beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
});

const renderCard = (onPick = vi.fn()) => {
	render(
		<Command>
			<CommandList>
				<PaletteActionCard card={card} onPick={onPick} />
			</CommandList>
		</Command>,
	);
	return onPick;
};

describe("PaletteActionCard", () => {
	it("hands each link to onPick with a telemetry id", () => {
		const onPick = renderCard();

		fireEvent.click(screen.getByText("Fetch BBPS Bill"));
		fireEvent.click(screen.getByText("Try it"));
		fireEvent.click(screen.getByText("Pay BBPS Bill"));

		expect(onPick.mock.calls).toEqual([
			[card.primary, "action:find_api:bbps-fetch-bill"],
			[card.secondary[0], "action:find_api:bbps-fetch-bill"],
			[card.alternatives[0], "action:find_api:bbps-fetch-bill:alt"],
		]);
	});

	it("shows the method pill and path", () => {
		renderCard();

		expect(screen.getByText("GET")).toBeInTheDocument();
		expect(screen.getByText("/customer/payment/bbps/bill")).toBeInTheDocument();
	});
});
