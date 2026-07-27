import { EkoLogo } from "@/components/EkoLogo";
import type { ReactNode } from "react";

/** Boilerplate printed under every receipt, matching Eloka's default. */
const TNC =
	"Eko at no such point of time has any right, title or interest over the " +
	"contract for sale of any of the products or services between the Retailer " +
	"and the Buyer nor shall Eko have any obligation or liabilities in respect " +
	"of such contract.";

/**
 * Wraps printable content with a header and footer that exist only on paper.
 *
 * The transaction widget renders its own receipt and calls `window.print()`
 * itself; the branding and terms that belong *around* that receipt live here.
 * Both blocks are `hidden` on screen and `print:flex`, so nothing about the
 * on-screen layout changes.
 *
 * Eloka's version also printed the retailer's shop name and address, read from
 * an org-detail context this app has no counterpart for — the console prints a
 * developer's own transactions, so the identity line is dropped rather than
 * faked.
 * @param props.heading - Optional caption ruled off above the content.
 * @param props.children - The content being printed.
 */
export function PrintReceipt({
	heading,
	children,
}: {
	heading?: string;
	children: ReactNode;
}) {
	return (
		<>
			<div className="hidden w-full flex-col print:flex">
				<EkoLogo className="h-10 w-auto" />
				{heading ? (
					<div className="my-2.5 border-y border-[#ccc] py-1 text-center text-xs">
						{heading}
					</div>
				) : null}
			</div>
			{children}
			<div className="hidden w-full flex-col print:flex">
				<p className="mt-4 text-[0.7em]">
					Provided by <strong>Eko</strong>
				</p>
				<p className="mt-4 text-[0.5em] italic">
					<sup>✢</sup>&nbsp;{TNC}
				</p>
			</div>
		</>
	);
}
