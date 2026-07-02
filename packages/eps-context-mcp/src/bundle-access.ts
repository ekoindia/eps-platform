import type {
	AgentApiDetail,
	AgentApiIndexEntry,
	AgentBundle,
	AgentTopicId,
	AgentTopics,
	Recipe,
} from "./bundle-types.js";

const toIndexEntry = (a: AgentApiDetail): AgentApiIndexEntry => ({
	slug: a.slug,
	productId: a.productId,
	productName: a.productName,
	name: a.name,
	method: a.method,
	path: a.path,
	summary: a.summary,
	category: a.category,
	relevance: a.relevance,
});

export const listApis = (
	bundle: AgentBundle,
	category?: string,
	limit?: number,
): AgentApiIndexEntry[] => {
	const entries = bundle.apis
		.filter((a) => !category || a.category === category)
		.map(toIndexEntry);
	return limit !== undefined ? entries.slice(0, limit) : entries;
};

/** Distinct categories present in the bundle, in first-seen order. */
export const listCategories = (bundle: AgentBundle): string[] => [
	...new Set(bundle.apis.map((a) => a.category)),
];

export const listTopics = (bundle: AgentBundle): AgentTopicId[] =>
	Object.keys(bundle.topics) as AgentTopicId[];

export const listRecipes = (
	bundle: AgentBundle,
): { id: string; name: string; summary: string }[] =>
	bundle.recipes.map((r) => ({ id: r.id, name: r.name, summary: r.summary }));

/** Zero-dependency token scoring over the compact index fields. */
export const searchApis = (
	bundle: AgentBundle,
	query: string,
	limit?: number,
): AgentApiIndexEntry[] => {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return listApis(bundle, undefined, limit);
	const scored = bundle.apis.map((a) => {
		const hay =
			`${a.name} ${a.summary} ${a.path} ${a.category} ${a.productName}`.toLowerCase();
		let score = 0;
		for (const t of terms) if (hay.includes(t)) score += 1;
		return { a, score };
	});
	const ranked = scored
		.filter((s) => s.score > 0)
		.sort((x, y) => y.score - x.score)
		.map((s) => toIndexEntry(s.a));
	return limit !== undefined ? ranked.slice(0, limit) : ranked;
};

export const getApi = (
	bundle: AgentBundle,
	slug: string,
): AgentApiDetail | undefined => bundle.apis.find((a) => a.slug === slug);

export const getTopic = <K extends AgentTopicId>(
	bundle: AgentBundle,
	topic: K,
): AgentTopics[K] | undefined => bundle.topics[topic];

export const getRecipe = (
	bundle: AgentBundle,
	id: string,
): Recipe | undefined => bundle.recipes.find((r) => r.id === id);
