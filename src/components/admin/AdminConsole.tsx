import { useState } from "react";
import { AdminDocsList } from "./AdminDocsList";

/** Admin GitOps console shell: docs list (left) + editor panel (right). */
export function AdminConsole() {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	return (
		<div className="w-full grid gap-6 md:grid-cols-[16rem_1fr]">
			<aside className="border-r pr-4">
				<AdminDocsList selected={selectedPath} onSelect={setSelectedPath} />
			</aside>
			<section>
				{selectedPath ? (
					<p className="text-sm text-muted-foreground">
						Editing {selectedPath} (editor loads in the next step).
					</p>
				) : (
					<p className="text-sm text-muted-foreground">Select a doc to edit.</p>
				)}
			</section>
		</div>
	);
}
