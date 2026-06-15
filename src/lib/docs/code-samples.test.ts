import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import {
	sampleFor,
	toCurl,
	toJsFetch,
	toPython,
} from "@/lib/docs/code-samples";

const panLite = API_SPECS_MAP["pan-lite"];
const getSpec = API_SPECS_MAP["dmt-get-sender"]; // GET with a path param

describe("code samples", () => {
	it("curl includes method, full URL, auth headers and a JSON body for POST", () => {
		const curl = toCurl(panLite);
		expect(curl).toContain("curl --request POST");
		expect(curl).toContain(`${DEFAULT_BASE_URL}${panLite.path}`);
		expect(curl).toContain("developer_key: <your_developer_key>");
		expect(curl).toContain("secret-key: <computed_secret_key>");
		expect(curl).toContain("--data");
		expect(curl).toContain("pan_number");
	});

	it("never leaks a real secret value (placeholders only)", () => {
		for (const lang of ["curl", "javascript", "python"] as const) {
			const out = sampleFor(panLite, lang);
			expect(out).toContain("<computed_secret_key>");
		}
	});

	it("JS fetch uses JSON.stringify for the body", () => {
		const js = toJsFetch(panLite);
		expect(js).toContain("fetch(");
		expect(js).toContain("JSON.stringify(");
		expect(js).toContain("await response.json()");
	});

	it("python emits requests with a dict payload and method call", () => {
		const py = toPython(panLite);
		expect(py).toContain("import requests");
		expect(py).toContain("requests.post(");
		expect(py).toContain('"pan_number"');
		expect(py).not.toContain("true"); // JS booleans must not leak into Python
	});

	it("substitutes path params and omits a body for GET", () => {
		const curl = toCurl(getSpec);
		expect(curl).toContain("curl --request GET");
		expect(curl).not.toContain("{customer_id}");
		expect(curl).not.toContain("--data");
	});
});
