import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import {
	SAMPLE_LANGS,
	SDK_LANGS,
	toGoSdk,
	toPythonSdk,
	toSampleLang,
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
import { describe, expect, it } from "vitest";

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

	it("appends common params as a query string for GET", () => {
		const curl = toCurl(getSpec);
		// initiator_id is a common param → query (not body) on a GET.
		expect(curl).toContain("?initiator_id=");
		// client_ref_id rides along on GET too, as another query param.
		expect(curl).toMatch(/[?&]client_ref_id=/);
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
	it("SDK_LANGS lists every language that ships an SDK package", () => {
		expect(SDK_LANGS.map((l) => l.id)).toEqual([
			"javascript",
			"php",
			"python",
			"go",
		]);
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

	it("includes path tokens in the call and client-level params in the ctor for a GET endpoint", () => {
		const node = toNodeSdk(getSpec);
		expect(node).toContain('await client.call("dmt-get-sender"');
		expect(node).toContain('"customer_id"'); // path token → call param
		// initiator_id is set once on the client, not per call.
		expect(node).toContain('initiatorId: "9962981729"');
		expect(node).not.toContain('"initiator_id"'); // not a call param anymore
	});

	it("Python SDK constructs the client and calls by slug with required params", () => {
		const py = toPythonSdk(panLite);
		expect(py).toContain("from eps_sdk import EpsClient");
		expect(py).toContain('os.environ["EPS_DEVELOPER_KEY"]');
		expect(py).toContain('client.call("pan-lite"');
		expect(py).toContain('"pan_number"');
		expect(py).toContain("print(result)");
		expect(py).not.toContain("secret-key");
	});

	it("Python SDK names client-level params by their wire name", () => {
		// The Python constructor is snake_case, unlike the JS camelCase options.
		expect(toPythonSdk(getSpec)).toContain('initiator_id="9962981729"');
	});

	it("Go SDK constructs the client and calls by slug with required params", () => {
		const go = toGoSdk(panLite);
		expect(go).toContain('eps "github.com/ekoindia/eps-sdk-go"');
		expect(go).toContain('os.Getenv("EPS_DEVELOPER_KEY")');
		expect(go).toContain('client.Call(context.Background(), "pan-lite"');
		expect(go).toContain('"pan_number"');
		expect(go).toContain("fmt.Println(result)");
		expect(go).not.toContain("secret-key");
	});

	it("Go SDK sets client-level params by their Go field name", () => {
		expect(toGoSdk(getSpec)).toContain('InitiatorID:  "9962981729"');
	});

	it("toSampleLang falls back to cURL for an SDK-only language", () => {
		// Go has an SDK but no raw-HTTP sample; cURL is the neutral wire view.
		expect(toSampleLang("go")).toBe("curl");
		expect(toSampleLang("python")).toBe("python");
	});

	it("sdkSampleFor dispatches per language", () => {
		expect(sdkSampleFor(panLite, "php")).toContain("$client->call(");
		expect(sdkSampleFor(panLite, "javascript")).toContain("client.call(");
		expect(sdkSampleFor(panLite, "python")).toContain("from eps_sdk import");
		expect(sdkSampleFor(panLite, "go")).toContain("eps.New(eps.Config{");
		// a lang with no SDK falls back to Node so SDK mode never blanks out
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

describe("multipart endpoints (file uploads)", () => {
	const multipart = API_SPECS_MAP["activate-aeps-fingpay"];

	/** The JSON inside the sample's `form-data=…` field, parsed back. */
	const envelopeFromCurl = (curl: string): Record<string, unknown> => {
		const match = curl.match(/--form-string 'form-data=(.*)'/);
		if (!match) throw new Error("no form-data part in:\n" + curl);
		return JSON.parse(match[1].replace(/'\\''/g, "'"));
	};

	it("curl sends one form-data envelope plus a part per file, never --data or a content-type header", () => {
		const curl = toCurl(multipart);
		expect(curl).toContain("--form 'pan_card=@/path/to/pan_card.jpg'");
		expect(curl).toContain("--form 'aadhar_front=@/path/to/aadhar_front.jpg'");
		// No form field of its own for a non-file param.
		expect(curl).not.toContain("--form 'modelname=");
		expect(curl).not.toContain("--data");
		expect(curl).not.toContain("content-type");
		expect(curl).toContain("secret-key: <computed_secret_key>");
	});

	it("the envelope carries every non-file field, objects staying nested", () => {
		const payload = envelopeFromCurl(toCurl(multipart));
		expect(payload).toMatchObject({
			initiator_id: expect.any(String),
			modelname: "Morpho 1300E3",
			account: "38759149196",
			ifsc: "SBIN0007515",
			office_address: { line: expect.any(String), state_id: "23" },
		});
		expect(payload).not.toHaveProperty("pan_card");
		expect(payload).not.toHaveProperty("user_code"); // path param
	});

	it("curl escapes shell quotes and uses --form-string so curl cannot read the JSON as a file reference", () => {
		const quoted = {
			...multipart,
			sampleRequest: { note: "d'Souza @file <in ;type=x", pan_card: "x" },
		};
		const curl = toCurl(quoted);
		// `'` closed and reopened, so the argument survives the shell...
		expect(curl).toContain(`'\\''`);
		// ...and the value goes through --form-string, where @ / < / ;type= are literal.
		expect(curl).toContain("--form-string 'form-data=");
		expect(envelopeFromCurl(curl).note).toBe("d'Souza @file <in ;type=x");
	});

	it("JS fetch appends one JSON form-data field plus the file parts", () => {
		const js = toJsFetch(multipart);
		expect(js).toContain("new FormData()");
		expect(js).toContain('form.append("form-data", JSON.stringify({');
		expect(js).toContain('form.append("pan_card", await openAsBlob(');
		expect(js).not.toContain('form.append("modelname"');
		expect(js).toContain('"body": form');
		expect(js).not.toContain("content-type");
	});

	it("python json.dumps-es the envelope and passes files separately", () => {
		const py = toPython(multipart);
		expect(py).toContain("import json");
		expect(py).toContain('data = {"form-data": json.dumps(payload)}');
		expect(py).toContain("files = {");
		expect(py).toContain('open("/path/to/pan_card.jpg", "rb")');
		expect(py).toContain("data=data, files=files");
		expect(py).not.toContain("content-type");
	});

	it("php json_encodes the envelope alongside CURLFile parts", () => {
		const php = toPhp(multipart);
		expect(php).toContain("'form-data' => json_encode($payload),");
		expect(php).toContain("new CURLFile('/path/to/pan_card.jpg')");
		expect(php).toContain("CURLOPT_POSTFIELDS, $fields");
		expect(php).not.toContain("content-type");
	});
});

describe("JSON endpoints are untouched by the multipart envelope", () => {
	it("never wrap a non-multipart body in a form-data field", () => {
		expect(toCurl(panLite)).toContain("--data");
		expect(toCurl(panLite)).not.toContain("form-data");
		expect(toJsFetch(panLite)).toContain("JSON.stringify(");
		expect(toJsFetch(panLite)).not.toContain("form-data");
		expect(toPython(panLite)).toContain("json=payload");
		expect(toPython(panLite)).not.toContain("form-data");
		expect(toPhp(panLite)).not.toContain("form-data");
	});
});

describe("SDK snippets for multipart endpoints", () => {
	const multipart = API_SPECS_MAP["activate-aeps-fingpay"];

	it("Node snippet passes file path placeholders with a Node-only note", () => {
		const js = toNodeSdk(multipart);
		expect(js).toContain('"pan_card": "/path/to/pan_card.jpg"');
		expect(js).not.toContain("<pan_card>");
		expect(js).toContain("file path (Node-only) or a Blob/File");
	});

	it("PHP snippet passes file path placeholders with a CURLFile note", () => {
		const php = toPhpSdk(multipart);
		expect(php).toContain("'pan_card' => '/path/to/pan_card.jpg'");
		expect(php).not.toContain("<pan_card>");
		expect(php).toContain("file path or a CURLFile");
	});

	it("JSON endpoints get no file note", () => {
		expect(toNodeSdk(panLite)).not.toContain("File params");
		expect(toPhpSdk(panLite)).not.toContain("File params");
	});
});
