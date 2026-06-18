import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { DocsNavTree } from "./DocsNavTree";
import { DocsThemeToggle, type DocsTheme } from "./DocsThemeToggle";

const THEME_KEY = "eko-docs-theme";

/**
 * Three-pane docs shell: left nav, page-scrolled middle content, and a right
 * rail (endpoint pages only) — all flowing together so nothing leaves a gap
 * when the fixed ~88px site header hides on scroll. On <lg the nav collapses
 * into a Sheet and the right rail stacks below.
 *
 * Theme is DOCS-LOCAL: a `.dark` class on this root subtree (persisted in
 * localStorage) flips only the docs to dark; the rest of the site is untouched.
 * Server renders light and the client applies the saved theme after mount, so
 * there is no hydration mismatch.
 */
export const DocsLayout = ({
	children,
	rightPane,
}: {
	children: React.ReactNode;
	rightPane?: React.ReactNode;
}) => {
	const [open, setOpen] = useState(false);
	const [theme, setTheme] = useState<DocsTheme>("light");

	useEffect(() => {
		const saved = localStorage.getItem(THEME_KEY);
		if (saved === "dark" || saved === "light") setTheme(saved);
	}, []);

	// Tint the page root (html) so the over-scroll bounce area matches the
	// docs-local dark theme instead of flashing the light site background.
	useEffect(() => {
		const root = document.documentElement;
		root.classList.toggle("docs-dark", theme === "dark");
		return () => root.classList.remove("docs-dark");
	}, [theme]);

	const toggleTheme = () =>
		setTheme((t) => {
			const next = t === "dark" ? "light" : "dark";
			try {
				localStorage.setItem(THEME_KEY, next);
			} catch {
				/* ignore */
			}
			return next;
		});

	return (
		<div
			className={cn(
				"min-h-screen bg-background text-foreground",
				theme === "dark" && "dark",
			)}
		>
			{/* Mobile toolbar (clears the fixed header) */}
			<div className="sticky top-[5.5rem] z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
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
				<DocsThemeToggle theme={theme} onToggle={toggleTheme} />
			</div>

			<div
				className={cn(
					"mx-auto grid max-w-[100rem] gap-0",
					rightPane
						? "lg:grid-cols-[16rem_minmax(0,1fr)_23rem] xl:grid-cols-[16rem_minmax(0,1fr)_28rem]"
						: "lg:grid-cols-[16rem_minmax(0,1fr)]",
				)}
			>
				{/* Left nav — flows with the page (scrolls together with the other
            panes). A compact theme toggle sits at the top on desktop. */}
				<aside className="hidden border-r border-border/60 lg:block bg-slate-50 dark:bg-[#0f2a3b]">
					<div className="px-3 pb-16 pt-28">
						<div className="mb-2 flex items-center justify-between px-3">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Docs
							</span>
							<DocsThemeToggle theme={theme} onToggle={toggleTheme} />
						</div>
						<DocsNavTree />
					</div>
				</aside>

				{/* Middle content — top padding clears the fixed header */}
				<main className="min-w-0 px-5 pb-16 pt-32 sm:px-8 lg:px-12">
					<div className="mx-auto max-w-3xl">{children}</div>
				</main>

				{/* Right rail — flows with the page (no inner scrollbar). Stacks
            below the content on <lg screens. */}
				{rightPane && (
					<aside className="dark min-w-0 border-border/60 bg-[#143a4e] px-3 pb-16 pt-8 text-foreground lg:border-l lg:pt-32">
						{rightPane}
					</aside>
				)}
			</div>
		</div>
	);
};
