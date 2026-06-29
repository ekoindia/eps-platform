import { useEffect, useState } from "react";
import { authClient, type DocItem } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Sidebar list of editable docs, grouped by type, with a select callback. */
export function AdminDocsList({
	selected,
	onSelect,
}: {
	selected: string | null;
	onSelect: (path: string) => void;
}) {
	const [docs, setDocs] = useState<DocItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		authClient.adminDocs
			.list()
			.then((r) => active && setDocs(r.docs))
			.catch(() => active && setError("Could not load docs."));
		return () => {
			active = false;
		};
	}, []);

	if (error) return <p className="text-sm text-destructive">{error}</p>;
	if (!docs)
		return (
			<div
				data-testid="docs-loading"
				className="flex flex-col gap-2"
				aria-busy="true"
			>
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-9 w-full rounded-md" />
				))}
			</div>
		);

	const groups: Array<{ label: string; type: DocItem["type"] }> = [
		{ label: "Guides", type: "guide" },
		{ label: "Endpoint notes", type: "endpoint" },
	];

	return (
		<nav className="flex flex-col gap-4">
			{groups.map((g) => {
				const items = docs.filter((d) => d.type === g.type);
				return (
					<div key={g.type}>
						<h2 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
							{g.label}{" "}
							<span className="ml-0.5 font-normal text-muted-foreground/60">
								{items.length}
							</span>
						</h2>
						{items.length === 0 ? (
							<p className="px-3 py-1 text-xs text-muted-foreground/70">
								Nothing here yet.
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{items.map((d) => (
									<li key={d.path}>
										<Button
											variant={selected === d.path ? "secondary" : "ghost"}
											className="w-full justify-start truncate"
											title={d.path}
											onClick={() => onSelect(d.path)}
										>
											{d.title}
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>
				);
			})}
		</nav>
	);
}
