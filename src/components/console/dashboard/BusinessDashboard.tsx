import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/auth/client";
import {
	type DashboardView,
	type DatePreset,
	type ServiceRef,
	describeRange,
	fetchDashboard,
	freshDashboard,
	serviceOptions,
} from "@/lib/console/dashboard";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardDateFilter from "./DashboardDateFilter";
import OverviewWidget from "./OverviewWidget";

/**
 * The chart widgets are lazy for one specific reason: `AppServer.tsx` imports
 * `ConsoleHome` EAGERLY for the static build, so a plain import of recharts
 * would pull ~100KB of charting into the SSG bundle and into the console's entry
 * chunk. Behind `lazy()` it lands in its own chunk, fetched only by a signed-in
 * partner looking at their own dashboard — and the primary metric paints before
 * that chunk has even been requested.
 *
 * Do not "simplify" these into static imports.
 */
const SuccessRatesWidget = lazy(() => import("./SuccessRatesWidget"));
const MostUsedServicesWidget = lazy(() => import("./MostUsedServicesWidget"));
const UsageAnalyticsWidget = lazy(() => import("./UsageAnalyticsWidget"));

const DEFAULT_PRESET: DatePreset = "last7";

/** Whether a view carries no activity at all, in any of its datasets. */
function isEmpty(view: DashboardView): boolean {
	return (
		view.overview.transactions.value === 0 &&
		view.mostUsedServices.length === 0 &&
		view.usage.length === 0
	);
}

/** The skeleton shown while the first view for a window loads. */
function DashboardSkeleton() {
	return (
		<div className="flex flex-col gap-6" data-testid="dashboard-loading">
			<Skeleton className="h-56 w-full rounded-xl" />
			<div className="grid gap-6 lg:grid-cols-3">
				<Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />
				<Skeleton className="h-72 w-full rounded-xl" />
			</div>
			<Skeleton className="h-80 w-full rounded-xl" />
		</div>
	);
}

/**
 * The console's business dashboard.
 *
 * Owns the window selection and the fetch; every widget below it is a pure
 * function of the view it is handed.
 */
export default function BusinessDashboard() {
	const [preset, setPreset] = useState<DatePreset>(DEFAULT_PRESET);
	const [typeId, setTypeId] = useState<string | undefined>(undefined);
	// Both the loaded view and the error are tagged with the query they belong
	// to, so switching window or service never shows the previous one's numbers
	// under the new one's label while the fetch is in flight.
	const [loaded, setLoaded] = useState<{
		preset: DatePreset;
		typeId?: string;
		view: DashboardView;
	} | null>(null);
	const [failed, setFailed] = useState<{
		preset: DatePreset;
		typeId?: string;
		error: ApiError | Error;
	} | null>(null);
	// Sticky: a filtered view only carries the selected service, so the options
	// are only ever refreshed from an unfiltered one. Without this the dropdown
	// collapses to whatever is already picked.
	const [options, setOptions] = useState<ServiceRef[]>([]);

	const matches = (tagged: { preset: DatePreset; typeId?: string } | null) =>
		tagged?.preset === preset && tagged.typeId === typeId;

	// Read during render, not written from an effect: the module cache means a
	// return to /console paints immediately instead of flashing skeletons, and
	// this page is remounted on every console navigation.
	const view =
		(matches(loaded) ? loaded?.view : null) ?? freshDashboard(preset, typeId);
	const error = matches(failed) ? failed?.error : null;

	useEffect(() => {
		if (freshDashboard(preset, typeId)) return;
		let live = true;
		fetchDashboard(preset, typeId)
			.then((next) => {
				if (live) setLoaded({ preset, typeId, view: next });
			})
			.catch((e: Error) => {
				if (live) setFailed({ preset, typeId, error: e });
			});
		return () => {
			live = false;
		};
	}, [preset, typeId]);

	useEffect(() => {
		if (view && !typeId) setOptions(serviceOptions(view));
	}, [view, typeId]);

	// A deployment without connect-api cannot serve this at all. That is a
	// configuration fact, not a fault, so it reads as a note rather than as the
	// red box a real failure gets.
	if (error instanceof ApiError && error.code === "DASHBOARD_UNAVAILABLE") {
		return (
			<div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
				Business analytics aren't available on this deployment.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<DashboardDateFilter
				preset={preset}
				onChange={(next) => {
					setPreset(next);
					// The selected service may have no activity in the new window, which
					// would read as "this service is broken". Eloka resets for the same
					// reason.
					setTypeId(undefined);
				}}
				description={view ? describeRange(view.range) : undefined}
			/>

			{error ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
				>
					{error.message || "Couldn't load your dashboard right now."}
				</div>
			) : null}

			{!view && !error ? <DashboardSkeleton /> : null}

			{view ? (
				<>
					{/* Zeros are rendered, not hidden. Hiding them would make "a quiet
					    week" indistinguishable from "we cannot see your account", and
					    the link is how a partner tells the two apart in one click. */}
					{isEmpty(view) ? (
						<p className="text-sm text-muted-foreground">
							No activity for your account in this window.{" "}
							<Link className="underline" to="/console/transactions">
								Check your transaction history
							</Link>
							.
						</p>
					) : null}

					<OverviewWidget
						view={view}
						services={options}
						typeId={typeId}
						onTypeIdChange={setTypeId}
					/>

					<div className="grid gap-6 lg:grid-cols-3">
						<div className="lg:col-span-2">
							<Suspense
								fallback={<Skeleton className="h-72 w-full rounded-xl" />}
							>
								<MostUsedServicesWidget rows={view.mostUsedServices} />
							</Suspense>
						</div>
						<Suspense
							fallback={<Skeleton className="h-72 w-full rounded-xl" />}
						>
							<SuccessRatesWidget rows={view.successRates} />
						</Suspense>
					</div>

					<Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
						<UsageAnalyticsWidget usage={view.usage} />
					</Suspense>
				</>
			) : null}
		</div>
	);
}
