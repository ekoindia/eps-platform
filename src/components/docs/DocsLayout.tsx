import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DocsNavTree } from "./DocsNavTree";

/**
 * Three-pane docs shell: sticky left nav, page-scrolled middle content, and a
 * right rail (endpoint pages only) that scrolls WITH the page — no inner
 * scrollbar. The fixed site header is ~88px tall, so panes/content offset by
 * that. On <lg the nav collapses into a Sheet and the right rail stacks below
 * the content. Pure layout — prerenders cleanly.
 */
export const DocsLayout = ({
	children,
	rightPane,
}: {
	children: React.ReactNode;
	rightPane?: React.ReactNode;
}) => {
	const [open, setOpen] = useState(false);

	return (
		<div className="bg-background">
			{/* Mobile nav toggle (clears the fixed header) */}
			<div className="sticky top-[5.5rem] z-30 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger asChild>
						<Button variant="outline" size="sm" className="gap-2">
							<Menu className="h-4 w-4" />
							Docs menu
						</Button>
					</SheetTrigger>
					<SheetContent
						side="left"
						className="docs-scroll w-80 overflow-y-auto p-4"
					>
						<DocsNavTree onNavigate={() => setOpen(false)} />
					</SheetContent>
				</Sheet>
			</div>

			<div
				className={cn(
					"mx-auto grid max-w-[100rem] gap-0",
					rightPane
						? "lg:grid-cols-[16rem_minmax(0,1fr)_20rem] xl:grid-cols-[16rem_minmax(0,1fr)_24rem]"
						: "lg:grid-cols-[16rem_minmax(0,1fr)]",
				)}
			>
				{/* Left nav — flows with the page (scrolls together with the other
            panes), so it never leaves a gap when the fixed header hides. */}
				<aside className="hidden border-r border-border/60 lg:block">
					<div className="px-3 pb-16 pt-24">
						<DocsNavTree />
					</div>
				</aside>

				{/* Middle content — top padding clears the fixed header */}
				<main className="min-w-0 px-5 pb-16 pt-24 sm:px-8 lg:px-12">
					<div className="mx-auto max-w-3xl">{children}</div>
				</main>

				{/* Right rail — flows with the page (no inner scrollbar). Stacks
            below the content on <lg screens. */}
				{rightPane && (
					<aside className="min-w-0 border-border/60 px-5 pb-16 pt-8 lg:border-l lg:pt-24">
						{rightPane}
					</aside>
				)}
			</div>
		</div>
	);
};
