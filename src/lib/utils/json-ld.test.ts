import { GLOBAL_FAQS } from "@/lib/data/common-faqs";
import { CONNECTED_BANKING_ENABLED } from "@/lib/data/connected-banking-pricing";
import {
	faqPageJsonLd,
	generateFaqJsonLd,
	generatePricingJsonLd,
} from "@/lib/utils/json-ld";
import { stripMarkdown } from "@/lib/utils";
import { describe, expect, it } from "vitest";

/** Narrow the JSON-LD object graph enough to assert on answers. */
type FaqPageNode = {
	"@type": string;
	"@id"?: string;
	mainEntity: Array<{
		name: string;
		acceptedAnswer: { text: string };
	}>;
};

const answersOf = (node: object): string[] =>
	(node as FaqPageNode).mainEntity.map((q) => q.acceptedAnswer.text);

/**
 * FAQ answers are authored in markdown, but `schema.org` `acceptedAnswer.text`
 * must be plain prose — Google renders it verbatim in rich results.
 */
describe("stripMarkdown", () => {
	it("flattens the subset FAQ answers are authored in", () => {
		expect(stripMarkdown("Send **both** headers.")).toBe("Send both headers.");
		expect(stripMarkdown("Use the `secret-key` header.")).toBe(
			"Use the secret-key header.",
		);
		expect(stripMarkdown("See [error codes](/docs/error-codes) first.")).toBe(
			"See error codes first.",
		);
		expect(stripMarkdown("An *important* caveat.")).toBe(
			"An important caveat.",
		);
		expect(stripMarkdown("Three things:\n\n- one\n- two\n- three")).toBe(
			"Three things: one two three",
		);
		expect(stripMarkdown("1. first\n2. second")).toBe("first second");
		expect(stripMarkdown("## Heading\n\nBody.")).toBe("Heading Body.");
		expect(stripMarkdown("![diagram](/img/x.png) follows")).toBe(
			"diagram follows",
		);
		expect(stripMarkdown("Literal \\*not bold\\* here")).toBe(
			"Literal *not bold* here",
		);
	});

	it("leaves plain prose untouched", () => {
		const plain = "Most verification APIs return in real time.";
		expect(stripMarkdown(plain)).toBe(plain);
	});
});

describe("faqPageJsonLd", () => {
	it("strips markdown out of every answer", () => {
		const node = faqPageJsonLd([
			{
				q: "Markdown?",
				a: "Send **both** the `developer_key` and [secret-key](/docs/how-auth-works).",
			},
		]);

		expect(answersOf(node)).toEqual([
			"Send both the developer_key and secret-key.",
		]);
	});

	it("accepts the question/answer shape used by industry & solution data", () => {
		const node = faqPageJsonLd([
			{ question: "Which shape?", answer: "**Both** work." },
		]);

		expect((node as FaqPageNode).mainEntity[0].name).toBe("Which shape?");
		expect(answersOf(node)).toEqual(["Both work."]);
	});

	it("omits @id when none is given", () => {
		expect(faqPageJsonLd([{ q: "a", a: "b" }])).not.toHaveProperty("@id");
		expect(faqPageJsonLd([{ q: "a", a: "b" }], "x#faq")).toHaveProperty(
			"@id",
			"x#faq",
		);
	});
});

describe("generateFaqJsonLd", () => {
	it("emits no markdown markers for the real global FAQ set", () => {
		const [node] = generateFaqJsonLd(GLOBAL_FAQS);

		for (const text of answersOf(node)) {
			expect(text, text).not.toMatch(/\*\*|`|\]\(/);
		}
	});

	it("returns nothing for an empty FAQ list", () => {
		expect(generateFaqJsonLd([])).toEqual([]);
	});
});

/**
 * The pricing graph carries a Connected Banking `OfferCatalog`. Search engines
 * cache structured data, so a disabled product must leave no Offer behind.
 *
 * The FAQ argument is the caller's (PricingPage / renderPricingMarkdown) to
 * filter — these assertions cover only the Offer nodes this function owns.
 */
describe("generatePricingJsonLd", () => {
	const graphJson = () => JSON.stringify(generatePricingJsonLd([]));

	it.runIf(!CONNECTED_BANKING_ENABLED)(
		"emits no Connected Banking offers while the product is disabled",
		() => {
			const json = graphJson();
			expect(json).not.toContain("#banking-offers");
			expect(json).not.toContain("Connected Banking");
		},
	);

	it.skipIf(!CONNECTED_BANKING_ENABLED)(
		"emits the Connected Banking OfferCatalog while the product is enabled",
		() => {
			expect(graphJson()).toContain("#banking-offers");
		},
	);
});
