/** Whether a field is disabled, optional or mandatory for an issue type. */
export const REQUIREMENT = {
	DISABLED: -1,
	OPTIONAL: 0,
	MANDATORY: 1,
} as const;

/** Generic issue types, used when no transaction type is in play. */
export const GENERIC_ISSUE_TYPE = {
	DEFAULT: "-1",
	ONBOARDING: "-2",
} as const;

/** Where the dialog was opened from; the support desk filters on it. */
export type FeedbackOrigin =
	| "Response"
	| "History"
	| "Global-Help"
	| "Command-Bar"
	| "Error-Boundary"
	| "Other";

/** A field the issue type wants filled in. */
export interface IssueInput {
	/** 9 = money, 11 = number, 12 = text. */
	type?: number;
	label: string;
	length_min?: number;
	length_max?: number;
	is_required?: boolean;
	value?: string;
}

/** A file the issue type wants attached. */
export interface IssueFile {
	label: string;
	is_required?: boolean;
	/** `accept` for the file input, e.g. `image/png,application/pdf`. */
	accept?: string;
	value?: File;
}

/** One selectable issue, after defaults have been filled in. */
export interface IssueType {
	/** 0 = raise a ticket, 1 = the answer is a link, so there is nothing to submit. */
	type: number;
	value: string;
	label: string;
	desc: string;
	/** How long after the transaction this may be raised, e.g. `2h`, `1d`. */
	raise_issue_after: string;
	/** Resolution time in days, as a string. */
	tat: string;
	comment: number;
	screenshot: number;
	context?: string;
	priority?: string;
	category: { id: number; title: string };
	sub_category: { id: number; title: string };
	inputs?: IssueInput[];
	files?: IssueFile[];
}

export interface Category {
	id: number;
	title: string;
}

/** The issue list, indexed the way the dialog steps through it. */
export interface IssueCatalogue {
	issues: IssueType[];
	categories: Category[];
	/** Category id → its sub-categories, in first-seen order. */
	subCategories: Record<number, Category[]>;
}

const DEFAULT_DESC =
	"Please share the details of your query/issue and we will get back to you soon.";

/**
 * Fills in the defaults the upstream leaves out, and indexes the list by
 * category and sub-category.
 *
 * The upstream sends a flat list where the (sub-)category is repeated on every
 * row; the dialog needs to offer them as two steps.
 * @param raw - `issuetype_list` as it arrives.
 * @returns The issues plus their category index.
 */
export function buildIssueCatalogue(raw: unknown): IssueCatalogue {
	const rows = Array.isArray(raw) ? raw : [];
	const categories: Category[] = [];
	const subCategories: Record<number, Category[]> = {};
	const seenSubCategory: Record<number, Set<number>> = {};

	const issues = rows.map((row) => {
		const entry = (row ?? {}) as Record<string, unknown>;
		const label = String(entry.label ?? entry.value ?? "");
		const category = (entry.category as Category) ?? {
			id: -1,
			title: "Others",
		};
		const subCategory = (entry.sub_category as Category) ?? {
			id: -1,
			title: "Others",
		};

		if (!seenSubCategory[category.id]) {
			categories.push(category);
			subCategories[category.id] = [];
			seenSubCategory[category.id] = new Set();
		}
		if (!seenSubCategory[category.id].has(subCategory.id)) {
			seenSubCategory[category.id].add(subCategory.id);
			subCategories[category.id].push(subCategory);
		}

		return {
			type: Number(entry.type ?? 0),
			value: String(entry.value ?? label),
			label,
			desc: String(entry.desc ?? DEFAULT_DESC),
			raise_issue_after: String(entry.raise_issue_after ?? "0d"),
			tat: String(entry.tat ?? "0"),
			comment: Number(entry.comment ?? REQUIREMENT.OPTIONAL),
			screenshot: Number(entry.screenshot ?? REQUIREMENT.OPTIONAL),
			context: entry.context ? String(entry.context) : undefined,
			priority: entry.priority ? String(entry.priority) : undefined,
			category,
			sub_category: subCategory,
			inputs: Array.isArray(entry.inputs)
				? (entry.inputs as IssueInput[]).map((input) => ({
						...input,
						value: "",
					}))
				: undefined,
			files: Array.isArray(entry.files)
				? (entry.files as IssueFile[]).map((file) => ({ ...file }))
				: undefined,
		} satisfies IssueType;
	});

	return { issues, categories, subCategories };
}

/**
 * Whether enough time has passed since the transaction for this issue to be
 * raised at all.
 *
 * `raise_issue_after` is a duration string — `0d`, `2h`, `30m`. Some issues are
 * pointless to raise immediately: a transfer still in flight is not a failure
 * yet, and a ticket raised inside the window only creates work for support.
 * @param issue - The selected issue type.
 * @param transactionTime - When the transaction happened, if known.
 * @param now - Clock, injectable for tests.
 * @returns True when the issue may be raised.
 */
export function isRaiseWindowOpen(
	issue: Pick<IssueType, "raise_issue_after">,
	transactionTime?: string,
	now: number = Date.now(),
): boolean {
	if (!transactionTime || !issue.raise_issue_after) return true;
	const duration = parseInt(issue.raise_issue_after, 10);
	if (!Number.isFinite(duration) || duration <= 0) return true;

	const unit = issue.raise_issue_after.slice(-1);
	const minutes = unit === "d" ? 24 * 60 : unit === "h" ? 60 : 1;
	const start = new Date(transactionTime.replace(" ", "T")).getTime();
	if (Number.isNaN(start)) return true;

	return now >= start + duration * minutes * 60_000;
}
