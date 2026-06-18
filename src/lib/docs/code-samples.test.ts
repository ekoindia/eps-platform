import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import {
	SAMPLE_LANGS,
	SDK_LANGS,
	sampleFor,
	sdkSampleFor,
	toAiPrompt,
	toCurl,
	toJsFetch,
	toNodeSdk,
	toPhp,
	toPhpSdk,
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
		for (const lang of ["curl", "javascript", "python", "php"] as const) {
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

	it("SAMPLE_LANGS exposes php and sampleFor handles it", () => {
		expect(SAMPLE_LANGS.map((l) => l.id)).toContain("php");
		expect(sampleFor(panLite, "php")).toContain("curl_init");
	});

	it("php emits curl_init, signed headers and a json_encode body for POST", () => {
		const php = toPhp(panLite);
		expect(php).toContain(`$url = '${DEFAULT_BASE_URL}${panLite.path}';`);
		expect(php).toContain("'developer_key: <your_developer_key>',");
		expect(php).toContain("'secret-key: <computed_secret_key>',");
		expect(php).toContain("curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');");
		expect(php).toContain("$payload = json_encode([");
		expect(php).toContain("curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);");
		expect(php).toContain("json_decode($response, true)");
		// JS booleans/null must not leak into PHP literals
		expect(php).not.toContain("True");
		expect(php).not.toContain("None");
	});

	it("php substitutes path params and omits a body for GET", () => {
		const php = toPhp(getSpec);
		expect(php).toContain("curl_init");
		expect(php).not.toContain("{customer_id}");
		expect(php).not.toContain("CURLOPT_POSTFIELDS");
		expect(php).not.toContain("json_encode");
	});

	it("php renders nested objects/arrays/bool/null as PHP literals", () => {
		const out = phpArrayProbe({
			str: "a'b",
			num: 3,
			yes: true,
			no: false,
			nada: null,
			list: [1, "two", { deep: true }],
			obj: { k: "v" },
		});
		expect(out).toContain("'str' => 'a\\'b'"); // escaped single quote
		expect(out).toContain("'yes' => true");
		expect(out).toContain("'no' => false");
		expect(out).toContain("'nada' => null");
		expect(out).toContain("'deep' => true");
		expect(out).toContain("=> [");
	});
});

describe("SDK snippets", () => {
	it("SDK_LANGS lists Node.js and PHP only", () => {
		expect(SDK_LANGS.map((l) => l.id)).toEqual(["javascript", "php"]);
	});

	it("Node SDK constructs the client and calls by slug with required params", () => {
		const node = toNodeSdk(panLite);
		expect(node).toContain('import { EpsClient } from "@ekoindia/eps-sdk"');
		expect(node).toContain("process.env.EPS_DEVELOPER_KEY");
		expect(node).toContain('await client.call("pan-lite"');
		expect(node).toContain('"pan_number"');
		expect(node).toContain("console.log(result)");
		// never embeds a real/placeholder secret — auth is the SDK's job
		expect(node).not.toContain("secret-key");
	});

	it("PHP SDK uses the namespaced client and print_r", () => {
		const php = toPhpSdk(panLite);
		expect(php).toContain("use Eko\\Eps\\EpsClient;");
		expect(php).toContain("getenv('EPS_DEVELOPER_KEY')");
		expect(php).toContain("$client->call('pan-lite'");
		expect(php).toContain("'pan_number'");
		expect(php).toContain("print_r($result)");
	});

	it("includes path tokens AND required query params for a GET endpoint", () => {
		// The whole point of the SDK GET fix: query params must appear in the call.
		const node = toNodeSdk(getSpec);
		expect(node).toContain('await client.call("dmt-get-sender"');
		expect(node).toContain('"customer_id"'); // path token
		expect(node).toContain('"initiator_id"'); // required query/body param
		expect(node).toContain('"user_code"');
	});

	it("sdkSampleFor dispatches php vs node", () => {
		expect(sdkSampleFor(panLite, "php")).toContain("$client->call(");
		expect(sdkSampleFor(panLite, "javascript")).toContain("client.call(");
		// non-php/non-js langs fall back to Node so SDK mode never blanks out
		expect(sdkSampleFor(panLite, "curl")).toContain("EpsClient");
	});
});

describe("AI prompt", () => {
	it("names the endpoint, slug and the MCP server", () => {
		const prompt = toAiPrompt(panLite);
		expect(prompt).toContain("eps-context-mcp");
		expect(prompt).toContain("PAN");
		expect(prompt).toContain("Slug: pan-lite");
		expect(prompt).toContain(panLite.path);
	});
});

/**
 * Exercise the PHP literal renderer through the public `toPhp` body output by
 * building a throwaway POST spec whose `sampleRequest` is the probe value.
 */
function phpArrayProbe(body: Record<string, unknown>): string {
	// panLite is already a POST spec; only swap in the probe body.
	return toPhp({ ...panLite, sampleRequest: body });
}
