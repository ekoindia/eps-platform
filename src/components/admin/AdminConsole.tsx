import { useState } from "react";
import { AdminDocsList } from "./AdminDocsList";
import { AdminDocEditor } from "./AdminDocEditor";
import { DeployToProduction } from "./DeployToProduction";

/** Admin GitOps console shell: docs list (left) + editor panel (right). */
export function AdminConsole() {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex justify-end">
				<DeployToProduction />
			</div>
			<div className="w-full grid gap-6 md:grid-cols-[16rem_1fr]">
				<aside className="border-r pr-4">
					<AdminDocsList selected={selectedPath} onSelect={setSelectedPath} />
				</aside>
				<section>
					{selectedPath ? (
						<AdminDocEditor key={selectedPath} path={selectedPath} />
					) : (
						<p className="text-sm text-muted-foreground">
							Select a doc to edit.
						</p>
					)}
				</section>
			</div>
		</div>
	);
}
