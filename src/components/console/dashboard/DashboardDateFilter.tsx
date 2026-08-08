import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHOW_DASHBOARD_LAST_365 } from "@/lib/config/features";
import { DASHBOARD_PRESETS, type DatePreset } from "@/lib/console/dashboard";

/**
 * The window picker, plus the line that says what the window actually is.
 *
 * Built on Radix Tabs rather than a select or a row of buttons: it is a
 * single-choice control over a short fixed list, and Tabs brings roving-tabindex
 * keyboard navigation and the right ARIA roles without any of it being written
 * here.
 * @param preset - The selected window.
 * @param onChange - Called with the new window.
 * @param description - The resolved dates, from `describeRange`.
 */
export default function DashboardDateFilter({
	preset,
	onChange,
	description,
}: {
	preset: DatePreset;
	onChange: (preset: DatePreset) => void;
	description?: string;
}) {
	return (
		<div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
			<p className="text-sm text-muted-foreground">{description ?? " "}</p>
			<Tabs
				value={preset}
				onValueChange={(value) => onChange(value as DatePreset)}
			>
				<TabsList className="max-w-full snap-x overflow-x-auto">
					{/* `last365` stays in `DASHBOARD_PRESETS` — the backend still serves
					    it and the list mirrors its `DATE_PRESETS`. Hidden here rather
					    than removed there: a year of upstream aggregation is slow, so
					    production caps the widest window at 30 days. */}
					{DASHBOARD_PRESETS.filter(
						(option) => option.value !== "last365" || SHOW_DASHBOARD_LAST_365,
					).map((option) => (
						<TabsTrigger
							key={option.value}
							value={option.value}
							className="snap-start whitespace-nowrap"
						>
							{option.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	);
}
