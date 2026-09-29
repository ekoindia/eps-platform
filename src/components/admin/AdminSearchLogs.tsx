import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	authClient,
	type SearchLogFilter,
	type SearchLogOverview,
	type SearchLogQueryCount,
	type SearchLogRow,
	type SearchLogSummary,
	LIFECYCLES,
} from "@/lib/auth/client";

const DAY_MS = 86_400_000;
/** `YYYY-MM-DD` in UTC — the day unit the backend filters on. */
const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Last 30 days, today included. */
const defaultFilter = (now: number = Date.now()): SearchLogFilter => ({
	from: utcDay(now - 29 * DAY_MS),
	to: utcDay(now),
});

/** `part` as a whole-number percentage of `total`; "–" when there is nothing to divide. */
const percent = (part: number, total: number): string =>
	total ? `${Math.round((part / total) * 100)}%` : "–";

/** "3 tries · 4.2s" — how hard the visitor worked; empty on pre-context rows. */
const effort = (row: SearchLogRow): string =>
	[
		row.refinements === null ? null : `${row.refinements + 1} tries`,
		row.durationMs === null ? null : `${(row.durationMs / 1000).toFixed(1)}s`,
	]
		.filter(Boolean)
		.join(" · ");

/** The summary cards, in the order a dropoff review reads them. */
const cards = (s: SearchLogSummary) => [
	{ label: "Searches", value: String(s.total) },
	{ label: "No results", value: percent(s.zeroResult, s.total) },
	{ label: "Clicked a result", value: percent(s.click, s.total) },
	{ label: "Abandoned", value: percent(s.abandon, s.total) },
	{ label: "Asked AI", value: percent(s.askAi, s.total) },
	{ label: "Full-text index loaded", value: percent(s.bodyIndexLoaded, s.total) },
];

/** One ranked query table. */
function TopTable({
	title,
	hint,
	items,
	onPick,
}: {
	title: string;
	hint: string;
	items: SearchLogQueryCount[];
	onPick: (query: string) => void;
}) {
	return (
		<div>
			<h3 className="text-sm font-medium">{title}</h3>
			<p className="text-xs text-muted-foreground mb-2">{hint}</p>
			{items.length === 0 ? (
				<p className="text-xs text-muted-foreground/70">Nothing in range.</p>
			) : (
				<Table>
					<TableBody>
						{items.map((item) => (
							<TableRow key={item.query}>
								<TableCell className="py-1.5">
									{/* Click-through filters the log below to this query. */}
									<button
										type="button"
										className="text-left hover:underline"
										onClick={() => onPick(item.query)}
									>
										{item.query}
									</button>
								</TableCell>
								<TableCell className="py-1.5 text-right tabular-nums">
									{item.count}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

/**
 * Admin view of ⌘K search logs: summary cards, top and top-failing queries,
 * a paged raw log, and JSONL/CSV export — all under one filter. The data is
 * redacted, session-free palette telemetry (docs/features/palette-telemetry.md).
 */
export function AdminSearchLogs() {
	// `draft` is what the form shows; `filter` is what was last applied. Loads
	// run on Apply, not per keystroke.
	const [draft, setDraft] = useState<SearchLogFilter>(() => defaultFilter());
	const [filter, setFilter] = useState<SearchLogFilter>(draft);
	const [overview, setOverview] = useState<SearchLogOverview | null>(null);
	const [rows, setRows] = useState<SearchLogRow[]>([]);
	const [nextBefore, setNextBefore] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Clearing happens where the filter changes (applyFilter), not in the
	// effect: the initial state is already empty.
	useEffect(() => {
		let active = true;
		Promise.all([
			authClient.adminSearchLogs.overview(filter),
			authClient.adminSearchLogs.rows(filter),
		])
			.then(([nextOverview, page]) => {
				if (!active) return;
				setOverview(nextOverview);
				setRows(page.rows);
				setNextBefore(page.nextBefore);
			})
			.catch(() => active && setError("Could not load search logs."));
		return () => {
			active = false;
		};
	}, [filter]);

	const loadMore = () => {
		if (nextBefore === null) return;
		authClient.adminSearchLogs
			.rows(filter, nextBefore)
			.then((page) => {
				setRows((current) => [...current, ...page.rows]);
				setNextBefore(page.nextBefore);
			})
			.catch(() => setError("Could not load more rows."));
	};

	const applyFilter = (next: SearchLogFilter) => {
		setOverview(null);
		setError(null);
		setFilter(next);
	};

	const pickQuery = (query: string) => {
		const next = { ...draft, q: query };
		setDraft(next);
		applyFilter(next);
	};

	return (
		<div className="flex flex-col gap-6">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					applyFilter({ ...draft });
				}}
				className="flex flex-wrap items-end gap-3"
			>
				<label className="flex flex-col gap-1 text-xs">
					From (UTC)
					<Input
						type="date"
						value={draft.from ?? ""}
						onChange={(e) => setDraft({ ...draft, from: e.target.value })}
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					To (UTC)
					<Input
						type="date"
						value={draft.to ?? ""}
						onChange={(e) => setDraft({ ...draft, to: e.target.value })}
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Query contains
					<Input
						value={draft.q ?? ""}
						maxLength={100}
						onChange={(e) => setDraft({ ...draft, q: e.target.value })}
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Outcome
					<select
						className="h-10 rounded-md border border-input bg-background px-3 text-sm"
						value={draft.outcome ?? ""}
						onChange={(e) =>
							setDraft({
								...draft,
								outcome: (e.target.value ||
									undefined) as SearchLogFilter["outcome"],
							})
						}
					>
						<option value="">Any</option>
						<option value="click">Clicked</option>
						<option value="abandon">Abandoned</option>
						<option value="ask_ai">Asked AI</option>
					</select>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Who
					<select
						className="h-10 rounded-md border border-input bg-background px-3 text-sm"
						value={draft.auth ?? ""}
						onChange={(e) =>
							setDraft({
								...draft,
								auth: (e.target.value || undefined) as SearchLogFilter["auth"],
								// Stage only exists for developers.
								stage: e.target.value === "developer" ? draft.stage : undefined,
							})
						}
					>
						<option value="">Anyone</option>
						<option value="anon">Signed out</option>
						<option value="developer">Developer</option>
						<option value="signup">Signing up</option>
						<option value="admin">Admin</option>
					</select>
				</label>
				{draft.auth === "developer" && (
					<label className="flex flex-col gap-1 text-xs">
						Account stage
						<select
							className="h-10 rounded-md border border-input bg-background px-3 text-sm"
							value={draft.stage ?? ""}
							onChange={(e) =>
								setDraft({
									...draft,
									stage: (e.target.value ||
										undefined) as SearchLogFilter["stage"],
								})
							}
						>
							<option value="">Any</option>
							{LIFECYCLES.map((stage) => (
								<option key={stage} value={stage}>
									{stage}
								</option>
							))}
						</select>
					</label>
				)}
				<Button type="submit">Apply</Button>
				<div className="ml-auto flex gap-2">
					<Button variant="outline" asChild>
						<a href={authClient.adminSearchLogs.exportUrl(filter, "jsonl")}>
							Export JSONL
						</a>
					</Button>
					<Button variant="outline" asChild>
						<a href={authClient.adminSearchLogs.exportUrl(filter, "csv")}>
							Export CSV
						</a>
					</Button>
				</div>
			</form>

			{error && <p className="text-sm text-destructive">{error}</p>}

			{/* `=== false`: an older backend omits the field, which is not a warning. */}
			{overview?.persistent === false && (
				<p
					role="alert"
					className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				>
					<strong>Search logs are in memory and lost on every restart.</strong>{" "}
					The backend has no <code>ANALYTICS_DB_PATH</code>, so each deploy
					wipes this page. Set it on a mounted volume — see the eps-backend VM
					deploy guide (<code>eps-analytics-data</code>).
				</p>
			)}

			{!overview && !error ? (
				<div className="grid gap-3 grid-cols-2 md:grid-cols-5" aria-busy="true">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-20 rounded-lg" />
					))}
				</div>
			) : overview ? (
				<>
					<div className="grid gap-3 grid-cols-2 md:grid-cols-5">
						{cards(overview.summary).map((card) => (
							<Card key={card.label}>
								<CardContent className="p-4">
									<p className="text-xs text-muted-foreground">{card.label}</p>
									<p className="text-2xl font-semibold tabular-nums">
										{card.value}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						<TopTable
							title="Top queries"
							hint="What people look for most."
							items={overview.top}
							onPick={pickQuery}
						/>
						<TopTable
							title="Top failing queries"
							hint="No results or abandoned — candidates for synonyms and new content."
							items={overview.topFailing}
							onPick={pickQuery}
						/>
					</div>
				</>
			) : null}

			<div>
				<h3 className="text-sm font-medium mb-2">Log</h3>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Hour (UTC)</TableHead>
							<TableHead>Query</TableHead>
							<TableHead className="text-right">Results</TableHead>
							<TableHead>Outcome</TableHead>
							<TableHead>Clicked</TableHead>
							<TableHead>Page</TableHead>
							<TableHead>Who</TableHead>
							<TableHead>Effort</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
									{row.ts.slice(0, 16).replace("T", " ")}
								</TableCell>
								<TableCell>{row.query}</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.resultCount}
								</TableCell>
								<TableCell>{row.outcome}</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{row.clickedCategory
										? `${row.clickedLabel ?? row.clickedCategory} (#${row.clickedRank})`
										: ""}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{row.page ?? ""}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{[row.auth, row.stage].filter(Boolean).join(" · ")}
								</TableCell>
								<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
									{effort(row)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{overview && rows.length === 0 && (
					<p className="mt-2 text-xs text-muted-foreground/70">
						No searches match this filter.
					</p>
				)}
				{nextBefore !== null && (
					<Button variant="ghost" className="mt-2" onClick={loadMore}>
						Load more
					</Button>
				)}
			</div>
		</div>
	);
}
