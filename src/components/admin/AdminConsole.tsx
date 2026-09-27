import { useState } from "react";
import { AdminDocsList } from "./AdminDocsList";
import { AdminDocEditor } from "./AdminDocEditor";
import { AdminSearchLogs } from "./AdminSearchLogs";
import { DeployToProduction } from "./DeployToProduction";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Admin console shell: GitOps docs editing, and ⌘K search logs. */
export function AdminConsole() {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	return (
		<Tabs defaultValue="docs">
			<TabsList>
				<TabsTrigger value="docs">Documentation</TabsTrigger>
				<TabsTrigger value="search">Search logs</TabsTrigger>
			</TabsList>
			<TabsContent value="docs" className="flex flex-col gap-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-sm font-medium">Documentation</h2>
						<p className="text-xs text-muted-foreground">
							Edit guides and endpoint notes, then propose changes as a pull
							request into dev.
						</p>
					</div>
					<DeployToProduction />
				</div>
				<Separator />
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
			</TabsContent>
			{/* Radix unmounts inactive tabs, so logs load only when opened. */}
			<TabsContent value="search">
				<AdminSearchLogs />
			</TabsContent>
		</Tabs>
	);
}
