import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** RFC 9727 API catalog served at /.well-known/api-catalog. Static file, so
 * the only thing that can rot is its JSON shape and the URLs it points at. */
describe("public/.well-known/api-catalog", () => {
	const catalog = JSON.parse(
		readFileSync(new URL("../../public/.well-known/api-catalog", import.meta.url), "utf8"),
	) as {
		linkset: {
			anchor: string;
			"service-desc"?: { href: string; type: string }[];
			"service-doc"?: { href: string }[];
		}[];
	};

	it("is a linkset whose site anchor points at the OpenAPI document", () => {
		const site = catalog.linkset.find((l) => l.anchor === "https://eps.eko.in/");
		expect(site?.["service-desc"]?.[0]).toMatchObject({
			href: "https://eps.eko.in/openapi.json",
		});
		expect(site?.["service-desc"]?.[0].type).toContain("openapi");
	});

	it("lists both MCP servers", () => {
		const anchors = catalog.linkset.map((l) => l.anchor);
		expect(anchors).toContain("https://mcp.eko.in/context/mcp");
		expect(anchors).toContain("https://mcp.eko.in/transact/mcp");
	});

	it("uses only absolute https URLs", () => {
		const hrefs = catalog.linkset.flatMap((l) =>
			Object.values(l)
				.filter(Array.isArray)
				.flat()
				.map((x) => (x as { href: string }).href),
		);
		for (const h of hrefs) expect(h).toMatch(/^https:\/\//);
	});
});
