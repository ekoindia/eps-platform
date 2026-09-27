import { useState } from "react";
import { AdminDocsList } from "./AdminDocsList";
import { AdminDocEditor } from "./AdminDocEditor";
import { AdminSearchLogs } from "./AdminSearchLogs";
import { DeployToProduction } from "./DeployToProduction";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Admin console shell: GitOps docs editing, and ⌘K search logs.
 * @param canEditDocs - False for an admin session with no GitHub identity (the
 *   local demo login). Its docs calls would 401 `NO_GH_TOKEN`, which the client
 *   reads as an expired session and signs the user out — so the docs tab is
 *   never mounted for it, and Search logs opens first.
 */
export function AdminConsole({ canEditDocs }: { canEditDocs: boolean }) {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	return (
		<Tabs defaultValue={canEditDocs ? "docs" : "search"}>
			<TabsList>
				<TabsTrigger value="docs">Documentation</TabsTrigger>
				<TabsTrigger value="search">Search logs</TabsTrigger>
			</TabsList>
			<TabsContent value="docs" className="flex flex-col gap-4">
				{canEditDocs ? (
					<>
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
								<AdminDocsList
									selected={selectedPath}
									onSelect={setSelectedPath}
								/>
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
					</>
				) : (
					<p className="text-sm text-muted-foreground">
						Editing docs and deploying need a GitHub sign-in: this session has
						no GitHub token. Sign out and use &ldquo;Sign in with GitHub&rdquo;.
					</p>
				)}
			</TabsContent>
			{/* Radix unmounts inactive tabs, so logs load only when opened. */}
			<TabsContent value="search">
				<AdminSearchLogs />
			</TabsContent>
		</Tabs>
	);
}
