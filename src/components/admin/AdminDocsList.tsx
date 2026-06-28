import { useEffect, useState } from "react";
import { authClient, type DocItem } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

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
		return <p className="text-sm text-muted-foreground">Loading docs…</p>;

	const groups: Array<{ label: string; type: DocItem["type"] }> = [
		{ label: "Guides", type: "guide" },
		{ label: "Endpoint notes", type: "endpoint" },
	];

	return (
		<nav className="flex flex-col gap-4">
			{groups.map((g) => (
				<div key={g.type}>
					<h2 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
						{g.label}
					</h2>
					<ul className="flex flex-col gap-1">
						{docs
							.filter((d) => d.type === g.type)
							.map((d) => (
								<li key={d.path}>
									<Button
										variant={selected === d.path ? "secondary" : "ghost"}
										className="w-full justify-start"
										onClick={() => onSelect(d.path)}
									>
										{d.title}
									</Button>
								</li>
							))}
					</ul>
				</div>
			))}
		</nav>
	);
}
