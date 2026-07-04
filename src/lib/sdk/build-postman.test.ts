import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import {
	buildPostmanCollection,
	PRE_REQUEST_SIGNING_SCRIPT,
} from "@/lib/sdk/build-postman";

const bundle = buildAgentBundle(getDocumentedSpecs());
const collection = buildPostmanCollection(bundle);

describe("buildPostmanCollection", () => {
	it("has an item per endpoint", () => {
		const count = collection.item.reduce(
			(n, folder) => n + (folder.item?.length ?? 0),
			0,
		);
		expect(count).toBe(bundle.apis.length);
	});

	it("ships a collection-level pre-request signing script", () => {
		const script = collection.event?.find((e) => e.listen === "prerequest");
		expect(script?.script.exec.join("\n")).toContain("CryptoJS.HmacSHA256");
	});

	it("the signing script computes secret-key from collection variables", () => {
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("access_key");
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("secret-key");
	});
});

describe("multipart endpoints", () => {
	it("uses formdata with file fields and no content-type header", () => {
		const flat = collection.item.flatMap((f) => f.item);
		const req = flat.find((i) =>
			String((i.request.url as { raw: string }).raw).includes(
				"aeps-fingpay/activate",
			),
		);
		expect(req).toBeDefined();
		const body = req?.request.body as {
			mode: string;
			formdata: { key: string; type: string }[];
		};
		expect(body.mode).toBe("formdata");
		expect(body.formdata.find((f) => f.key === "pan_card")?.type).toBe("file");
		expect(body.formdata.find((f) => f.key === "modelname")?.type).toBe("text");
		const headers = req?.request.header as { key: string }[];
		expect(headers.some((h) => h.key === "content-type")).toBe(false);
	});
});
