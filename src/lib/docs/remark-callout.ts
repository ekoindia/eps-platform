/**
 * remark plugin: GitHub-style alert blockquotes → callout nodes.
 *
 * Turns
 *   > [!WARNING]
 *   > You need to encrypt the Aadhaar number…
 * into a custom `callout` element (via mdast `data.hName`) that
 * {@link ../../components/docs/Callout} renders as a styled box. The marker is
 * stripped from the text. Dependency-free: a small manual tree walk, no
 * `unist-util-visit`. SSR-safe — pure data transform.
 *
 * Only React rendering uses this; the `.md` twins keep the raw
 * `> [!WARNING]` blockquote (native GitHub alert), so every sink stays in sync.
 */

/** GitHub alert types we recognise. */
const ALERT_TYPES = new Set([
	"note",
	"tip",
	"important",
	"warning",
	"caution",
	"danger",
]);

const MARKER = /^\[!(\w+)\]\s*\n?/;

interface MdNode {
	type: string;
	value?: string;
	children?: MdNode[];
	data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** Promote a blockquote to a callout if its first line is `[!TYPE]`. */
function toCallout(node: MdNode): void {
	const firstPara = node.children?.[0];
	if (firstPara?.type !== "paragraph") return;
	const firstText = firstPara.children?.[0];
	if (firstText?.type !== "text" || typeof firstText.value !== "string") return;

	const match = MARKER.exec(firstText.value);
	if (!match) return;
	const type = match[1].toLowerCase();
	if (!ALERT_TYPES.has(type)) return;

	// Strip the `[!TYPE]` marker; drop the text node if nothing remains.
	firstText.value = firstText.value.slice(match[0].length);
	if (firstText.value === "") firstPara.children?.shift();

	node.data = {
		...node.data,
		hName: "callout",
		hProperties: { ...node.data?.hProperties, type },
	};
}

/** Walk the tree, converting every qualifying blockquote in place. */
function walk(node: MdNode): void {
	if (!node.children) return;
	for (const child of node.children) {
		if (child.type === "blockquote") toCallout(child);
		walk(child);
	}
}

export function remarkCallout() {
	return (tree: MdNode): void => walk(tree);
}
