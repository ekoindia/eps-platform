import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ApiError, transactionsClient } from "@/lib/auth/client";
import {
	creditOf,
	debitOf,
	deriveAmount,
	describeRow,
	hueOf,
	inferSearchField,
	initialsOf,
	PAGE_LIMIT,
	statusOf,
	totalsOf,
	type TransactionFilters,
	type TransactionRow,
} from "@/lib/console/transactions";
import { formatINR } from "@/lib/utils";
import {
	ChevronLeft,
	ChevronRight,
	ListFilter,
	Minus,
	Plus,
	Search,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/** Columns, in render order. `colSpan` for the expanded row is derived from this. */
const COLUMNS = [
	"",
	"Summary",
	"Transaction Amount",
	"Debit",
	"Credit",
	"Running Balance",
	"Date & Time",
	"Status",
] as const;

/** The filter fields, as rendered in the dialog. */
const FILTER_FIELDS: Array<{
	name: keyof TransactionFilters;
	label: string;
	type?: string;
	placeholder?: string;
}> = [
	{ name: "tid", label: "TID", placeholder: "Transaction id" },
	{ name: "account", label: "Account Number" },
	{ name: "customer_mobile", label: "Customer Mobile No." },
	{ name: "start_date", label: "From", type: "date" },
	{ name: "tx_date", label: "To", type: "date" },
	{ name: "amount", label: "Amount", placeholder: "₹" },
	{ name: "rr_no", label: "Tracking Number" },
];

/** Formats "2026-04-16 11:49:00" as a two-line date and time. */
function formatDateTime(raw: string): { date: string; time: string } {
	const parsed = new Date(raw.replace(" ", "T"));
	if (Number.isNaN(parsed.getTime())) return { date: raw, time: "" };
	return {
		date: parsed.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		}),
		time: parsed.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
		}),
	};
}

/** The avatar + name + counterparty line that opens each row. */
function SummaryCell({ row }: { row: TransactionRow }) {
	const hue = hueOf(row.tx_name);
	const description = describeRow(row);
	return (
		<div className="flex items-center gap-3">
			<span
				aria-hidden="true"
				className="notranslate flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
				style={{
					backgroundColor: `hsl(${hue} 80% 95%)`,
					borderColor: `hsl(${hue} 80% 85%)`,
					color: `hsl(${hue} 80% 25%)`,
				}}
			>
				{initialsOf(row.tx_name)}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.tx_name}</span>
				{description ? (
					<span className="truncate text-xs text-muted-foreground">
						{description}
					</span>
				) : null}
			</span>
		</div>
	);
}

/** The "Other Details" panel revealed under an expanded row. */
function RowDetails({ row }: { row: TransactionRow }) {
	const status = statusOf(row);
	const { amount } = deriveAmount(row);
	const details: Array<{ label: string; value: string }> = [
		{ label: "Status", value: status.label },
		{ label: "Amount", value: formatINR(amount, 2, 2) },
		{ label: "TID", value: row.tid },
		...(row.rrn ? [{ label: "RRN", value: row.rrn }] : []),
		...(row.trackingnumber
			? [{ label: "Tracking Number", value: row.trackingnumber }]
			: []),
		...(row.customer_name
			? [{ label: "Customer", value: row.customer_name }]
			: []),
		...(row.customer_mobile
			? [{ label: "Customer Mobile", value: row.customer_mobile }]
			: []),
		...(row.account ? [{ label: "Account", value: row.account }] : []),
		...(row.bank ? [{ label: "Bank", value: row.bank }] : []),
		...(row.operator ? [{ label: "Operator", value: row.operator }] : []),
		...(row.recipient_name
			? [{ label: "Recipient", value: row.recipient_name }]
			: []),
		...(row.fee > 0
			? [{ label: "Charges", value: formatINR(row.fee, 2, 2) }]
			: []),
		...(row.commission_earned > 0
			? [{ label: "Commission", value: formatINR(row.commission_earned, 2, 2) }]
			: []),
	];
	return (
		<div className="flex flex-col gap-3 bg-muted/40 px-4 py-3">
			<p className="text-xs font-medium text-muted-foreground">Other Details</p>
			<dl className="flex flex-wrap gap-x-8 gap-y-3">
				{details.map((detail) => (
					<div key={detail.label} className="flex flex-col">
						<dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
							{detail.label}
						</dt>
						<dd className="text-xs font-semibold">{detail.value}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

/**
 * Console Transactions: the signed-in developer's own transaction history.
 *
 * Totals are per-page — upstream returns no grand totals — and the page is
 * fetched only for an `active` account, since no other lifecycle state can have
 * transactions.
 */
export default function Transactions() {
	const me = useConsoleMe();
	const isActive = me.state === "active";

	const [rows, setRows] = useState<TransactionRow[]>([]);
	const [hasNext, setHasNext] = useState(false);
	const [startIndex, setStartIndex] = useState(0);
	const [filters, setFilters] = useState<TransactionFilters>({});
	const [loading, setLoading] = useState(isActive);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filterOpen, setFilterOpen] = useState(false);
	const [draft, setDraft] = useState<TransactionFilters>({});

	useEffect(() => {
		if (!isActive) return;
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		transactionsClient
			.search(
				{ start_index: startIndex, limit: PAGE_LIMIT, filters },
				controller.signal,
			)
			.then((page) => {
				setRows(page.rows);
				setHasNext(page.hasNext);
				setExpanded(null);
			})
			.catch((err: unknown) => {
				if (controller.signal.aborted) return;
				setError(
					err instanceof ApiError
						? err.message
						: "Couldn't load your transactions. Please try again.",
				);
				setRows([]);
				setHasNext(false);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [isActive, startIndex, filters]);

	const totals = useMemo(() => totalsOf(rows), [rows]);
	const filterCount = Object.values(filters).filter(Boolean).length;

	/** Applies a quick search by guessing which field the query means. */
	function onSearch(event: React.FormEvent) {
		event.preventDefault();
		const guess = inferSearchField(search);
		setStartIndex(0);
		// Send the NORMALIZED value, not the raw input: "2,00,000" classifies as an
		// amount but the backend's filter rules reject the commas.
		setFilters(guess ? { [guess.field]: guess.value } : {});
	}

	function applyFilters() {
		const cleaned = Object.fromEntries(
			Object.entries(draft).filter(([, value]) => value !== ""),
		);
		setStartIndex(0);
		setFilters(cleaned);
		setFilterOpen(false);
	}

	function clearFilters() {
		setStartIndex(0);
		setFilters({});
		setDraft({});
		setSearch("");
		setFilterOpen(false);
	}

	if (!isActive) {
		return (
			<div className="flex flex-col gap-6">
				<Header />
				<div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
					<p>
						Transactions appear here once your account is active. Finish
						onboarding to start transacting.
					</p>
					<Link
						to="/signup"
						className="mt-3 inline-block font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
					>
						Continue onboarding
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Header />

			<div className="flex flex-wrap items-center justify-end gap-2">
				<form onSubmit={onSearch} className="relative flex-1 sm:max-w-xs">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by TID, Mobile, Account, etc"
						aria-label="Search transactions"
						className="pl-8"
					/>
				</form>
				<Dialog
					open={filterOpen}
					onOpenChange={(open) => {
						setFilterOpen(open);
						if (open) setDraft(filters);
					}}
				>
					<DialogTrigger asChild>
						<Button variant="outline" className="gap-2">
							<ListFilter className="h-4 w-4" />
							Filter
							{filterCount > 0 ? (
								<Badge variant="secondary">{filterCount}</Badge>
							) : null}
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Filter</DialogTitle>
						</DialogHeader>
						<div className="flex flex-col gap-3">
							{FILTER_FIELDS.map((field) => (
								<div key={field.name} className="flex flex-col gap-1.5">
									<Label htmlFor={`filter-${field.name}`}>{field.label}</Label>
									<Input
										id={`filter-${field.name}`}
										type={field.type ?? "text"}
										placeholder={field.placeholder}
										value={draft[field.name] ?? ""}
										onChange={(e) =>
											setDraft((d) => ({ ...d, [field.name]: e.target.value }))
										}
									/>
								</div>
							))}
						</div>
						<DialogFooter>
							<Button variant="ghost" onClick={clearFilters}>
								Clear all
							</Button>
							<Button onClick={applyFilters}>Apply</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{error ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
					{error}
				</div>
			) : null}

			{loading ? (
				<div className="flex flex-col gap-2" data-testid="transactions-loading">
					{Array.from({ length: 5 }, (_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : null}

			{!loading && !error && rows.length === 0 ? (
				<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
					Nothing found{filterCount > 0 ? " for these filters" : " yet"}.
				</div>
			) : null}

			{!loading && !error && rows.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							{COLUMNS.map((column, i) => (
								<TableHead
									key={column || "expand"}
									className={i > 1 && i < 6 ? "text-right" : undefined}
								>
									{column || <span className="sr-only">Expand</span>}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => {
							const { amount, trxType } = deriveAmount(row);
							const debit = debitOf(row);
							const credit = creditOf(row);
							const status = statusOf(row);
							const when = formatDateTime(row.datetime);
							const isOpen = expanded === row.tid;
							return (
								<Fragment key={row.tid}>
									<TableRow>
										<TableCell>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												aria-expanded={isOpen}
												aria-label={
													isOpen
														? `Hide details for ${row.tx_name}`
														: `Show details for ${row.tx_name}`
												}
												onClick={() => setExpanded(isOpen ? null : row.tid)}
											>
												{isOpen ? (
													<Minus className="h-4 w-4" />
												) : (
													<Plus className="h-4 w-4" />
												)}
											</Button>
										</TableCell>
										<TableCell className="min-w-56">
											<SummaryCell row={row} />
										</TableCell>
										<TableCell
											className={`text-right tabular-nums ${
												trxType === "DR" ? "text-destructive" : ""
											}`}
										>
											{trxType === "DR" ? "− " : ""}
											{formatINR(amount)}
										</TableCell>
										<TableCell className="bg-red-50/60 text-right tabular-nums dark:bg-red-950/20">
											{debit > 0 ? formatINR(debit, 2, 2) : ""}
										</TableCell>
										<TableCell className="bg-emerald-50/60 text-right tabular-nums dark:bg-emerald-950/20">
											{credit > 0 ? formatINR(credit, 2, 2) : ""}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatINR(row.r_bal, 2, 2)}
										</TableCell>
										<TableCell className="whitespace-nowrap text-sm">
											<span className="flex flex-col">
												<span>{when.date}</span>
												<span className="text-muted-foreground">
													{when.time}
												</span>
											</span>
										</TableCell>
										<TableCell>
											<Badge variant={status.variant}>{status.label}</Badge>
										</TableCell>
									</TableRow>
									{isOpen ? (
										<TableRow>
											<TableCell colSpan={COLUMNS.length} className="p-0">
												<RowDetails row={row} />
											</TableCell>
										</TableRow>
									) : null}
								</Fragment>
							);
						})}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell
								colSpan={3}
								className="text-right text-muted-foreground"
							>
								Totals for this page
							</TableCell>
							<TableCell className="text-right tabular-nums font-semibold">
								{formatINR(totals.debit, 2, 2)}
							</TableCell>
							<TableCell className="text-right tabular-nums font-semibold">
								{formatINR(totals.credit, 2, 2)}
							</TableCell>
							<TableCell className="text-right tabular-nums font-semibold">
								{totals.closing === null ? "" : formatINR(totals.closing, 2, 2)}
							</TableCell>
							<TableCell colSpan={2} />
						</TableRow>
					</TableFooter>
				</Table>
			) : null}

			{!loading && !error && (startIndex > 0 || hasNext) ? (
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={startIndex === 0}
						onClick={() => setStartIndex((i) => Math.max(0, i - PAGE_LIMIT))}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {Math.floor(startIndex / PAGE_LIMIT) + 1}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={!hasNext}
						onClick={() => setStartIndex((i) => i + PAGE_LIMIT)}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			) : null}
		</div>
	);
}

/** The page's title block. */
function Header() {
	return (
		<div className="flex flex-col gap-1">
			<h2 className="text-lg font-semibold text-eko-navy">
				Transaction History
			</h2>
			<p className="text-sm text-muted-foreground">
				Your account's transactions, newest first.
			</p>
		</div>
	);
}
