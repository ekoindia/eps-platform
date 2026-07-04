/**
 * Reusable, named sets of multi-language code snippets shown in docs guides via
 * the `<CodeSnippets id="…" />` MDX component.
 *
 * PLAIN DATA — no React, no browser globals — so this module is importable from
 * BOTH the client component (`src/components/docs/CodeSnippets.tsx`) and the Node
 * markdown-twin renderer (`src/lib/markdown/render-doc.ts`). The `.md` twin emits
 * only the FIRST snippet (the default language); the HTML page shows all as tabs.
 *
 * The `sign-request` set mirrors the tested signing snippets served by the MCP
 * `get_signing_snippet` tool (`packages/eps-context-mcp/src/signing-snippets.ts`).
 * They are kept as an intentional website-local copy (the two ship separately);
 * `code-snippet-sets.test.ts` pins the correct HMAC convention on every language.
 */

/** One language variant within a snippet set. `language` doubles as the Prism
 * grammar name AND the markdown fence tag emitted into the `.md` twin. */
export interface CodeSnippet {
	language: string;
	label: string;
	code: string;
}

const SIGN_REQUEST: CodeSnippet[] = [
	{
		language: "javascript",
		label: "Node.js",
		code: `// Backend only. Never expose access_key in a browser.
import crypto from "node:crypto";

const accessKey = process.env.EKO_ACCESS_KEY;
const timestamp = Date.now().toString();
const encodedKey = Buffer.from(accessKey).toString("base64");
const secretKey = crypto
	.createHmac("sha256", encodedKey)
	.update(timestamp)
	.digest("base64");
// headers: { developer_key, "secret-key": secretKey, "secret-key-timestamp": timestamp }`,
	},
	{
		language: "python",
		label: "Python",
		code: `# Backend only. Never expose access_key in a browser.
import base64, hashlib, hmac, os, time

access_key = os.environ["EKO_ACCESS_KEY"]
timestamp = str(int(time.time() * 1000))
encoded_key = base64.b64encode(access_key.encode())
secret_key = base64.b64encode(
    hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
).decode()
# headers: developer_key, secret-key: secret_key, secret-key-timestamp: timestamp`,
	},
	{
		language: "php",
		label: "PHP",
		code: `<?php
// Backend only. Never expose access_key in a browser.
$accessKey = getenv('EKO_ACCESS_KEY');
$timestamp = (string) round(microtime(true) * 1000);
$encodedKey = base64_encode($accessKey);
$secretKey = base64_encode(hash_hmac('sha256', $timestamp, $encodedKey, true));
// Send headers: developer_key, secret-key: $secretKey, secret-key-timestamp: $timestamp`,
	},
	{
		language: "java",
		label: "Java 8+",
		code: `// Backend only. Never expose access_key in a browser.
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

String accessKey = System.getenv("EKO_ACCESS_KEY");
String timestamp = String.valueOf(System.currentTimeMillis());
String encodedKey = Base64.getEncoder().encodeToString(accessKey.getBytes("UTF-8"));
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(encodedKey.getBytes("UTF-8"), "HmacSHA256"));
String secretKey = Base64.getEncoder().encodeToString(mac.doFinal(timestamp.getBytes("UTF-8")));`,
	},
	{
		language: "csharp",
		label: ".NET (C#)",
		code: `// Backend only. Never expose access_key in a browser.
using System;
using System.Security.Cryptography;
using System.Text;

string accessKey = Environment.GetEnvironmentVariable("EKO_ACCESS_KEY");
string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
string encodedKey = Convert.ToBase64String(Encoding.UTF8.GetBytes(accessKey));
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(encodedKey));
string secretKey = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp)));`,
	},
];

/** Named snippet sets addressable by `<CodeSnippets id="…" />`. */
export const CODE_SNIPPET_SETS: Record<string, CodeSnippet[]> = {
	"sign-request": SIGN_REQUEST,
};

/** The snippets for a set, or `undefined` for an unknown id. */
export const getSnippetSet = (id: string): CodeSnippet[] | undefined =>
	CODE_SNIPPET_SETS[id];

/** The default (first) snippet of a set — the one the `.md` twin emits. */
export const defaultSnippet = (id: string): CodeSnippet | undefined =>
	CODE_SNIPPET_SETS[id]?.[0];
