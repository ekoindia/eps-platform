/** Interaction that creates a support ticket (`RAISE_ISSUE`). */
export const RAISE_ISSUE_INTERACTION = 10000;

/** Interaction that lists the query types a transaction may be queried with. */
export const QUERY_TYPES_INTERACTION = 10022;

/** One user-filled field the issue type asked for. */
export interface TicketInputField {
	label: string;
	value: string;
}

/** Everything a ticket is built from, once the BFF has added its own context. */
export interface TicketInput {
	/** The issue-type label — becomes the ticket subject. */
	summary: string;
	category?: string;
	subCategory?: string;
	/** The user's own words. */
	comment?: string;
	/** Notes the issue type carries for the support team; never shown to the user. */
	context?: string;
	inputs?: TicketInputField[];
	origin?: string;
	tat?: string;
	priority?: string;
	tid?: string;
	txTypeId?: string;
	/** Free-form transaction details echoed back from the flow. */
	transactionDetail?: unknown;
	/** Preamble the flow wants at the end of the description. */
	preMsgTemplate?: string;
	/** Facts only the browser knows. */
	client?: {
		useragent?: string;
		screen?: string;
		deviceTime?: string;
		url?: string;
	};
	/** Who is raising it, from the session — never from the browser. */
	user?: {
		mobile?: string;
		orgId?: number;
		zohoId?: string;
		role?: string;
	};
	/** Prefixes the subject with `[IGNORE]` so support can filter test tickets. */
	isProduction: boolean;
}

/** Escapes HTML so a user's comment cannot inject markup into the ticket. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Escapes, then turns newlines into the `<br>` the ticket body renders. */
function toHtml(value: string): string {
	return escapeHtml(value).replace(/(?:\r\n|\r|\n)/g, "<br>");
}

/**
 * Whether tickets raised against this connect-api land in production.
 *
 * There is no environment flag on this service, and the one that matters is the
 * environment of the API the ticket is filed in — which the base URL names.
 * @param connectBaseUrl - The configured connect-api base URL.
 * @returns True only for a production host.
 */
export function isProductionConnect(connectBaseUrl: string): boolean {
	return !/beta|uat|staging|dev|test|localhost|127\.0\.0\.1/i.test(
		connectBaseUrl,
	);
}

/**
 * Builds the interaction fields for a support ticket.
 *
 * Formatting lives here rather than in the browser deliberately: the ticket
 * schema is Zoho-Desk's, and a console that never learns it cannot be used to
 * forge a ticket that looks like it came from somewhere else. The browser sends
 * only what it alone knows — the user's answers and its own user-agent — and
 * everything about *who* is asking is added from the session.
 * @param input - The user's answers plus the session context.
 * @returns Flat string fields, ready to post as an interaction.
 */
export function buildTicketFields(input: TicketInput): Record<string, string> {
	const prefix = input.isProduction
		? ""
		: "UAT TESTING!! Please ignore this ticket.<br><br>";
	const comment = input.comment
		? prefix + toHtml(input.comment)
		: prefix.trim();
	const context = input.context ? toHtml(input.context) : "";

	let commentMessage = "";
	let description = "";

	if (comment) {
		commentMessage = `<p>Comments:<br>${comment}</p>`;
		description = `<p><strong>COMMENT:</strong><br>${comment}</p>\n`;
	}

	if (context) {
		commentMessage += `<p>Notes for Support Team:<br>${context}</p>`;
		description += `<p><strong>NOTES FOR SUPPORT TEAM:</strong><br>${context}</p>`;
	}

	const filled = (input.inputs ?? []).filter((field) => field.value);
	if (filled.length) {
		description += "<ul>";
		for (const field of filled) {
			const label = escapeHtml(field.label);
			const value = escapeHtml(field.value);
			description += `<li><strong>${label}:</strong> ${value}</li>\n`;
			commentMessage += `${label}: ${value}\n`;
		}
		description += "</ul>";
	}

	if (input.preMsgTemplate) {
		description += `\n<p>${escapeHtml(input.preMsgTemplate)}</p>`;
	}

	return {
		interaction_type_id: String(RAISE_ISSUE_INTERACTION),
		summary: (input.isProduction ? "" : "[IGNORE] ") + input.summary,
		description,
		category: input.category || "Others",
		sub_category: input.subCategory || "Others",
		// The sub-sub-category, in Zoho Desk's taxonomy.
		feedback_issue_type: input.summary,
		tid: input.tid || "",
		tx_typeid: input.txTypeId || "",
		tat: input.tat || "",
		priority: input.priority || "",
		feedback_origin: input.origin || "",
		comment: commentMessage,
		technical_notes: JSON.stringify({
			app: {
				url: input.client?.url || "",
				org_id: input.user?.orgId ?? "",
				app_name: "EPS Developer Console",
			},
			user: {
				user_mobile: input.user?.mobile || "",
				user_zoho_id: input.user?.zohoId || "",
				roles: input.user?.role || "",
			},
			transaction_details: input.transactionDetail,
			useragent: input.client?.useragent || "",
			screen: input.client?.screen || "",
			device_time: input.client?.deviceTime || "",
			appsource: "eps-console",
		}),
	};
}
