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

/**
 * Android RDService integration via Eko's open-source
 * `android-uidai-rdservice-manager` library (JitPack). Mirrors the library
 * README (v1.3.x), which uses the classic `onActivityResult` flow.
 */
const RDSERVICE_ANDROID: CodeSnippet[] = [
	{
		language: "kotlin",
		label: "Kotlin",
		code: `// build.gradle: implementation 'com.github.ekoindia:android-uidai-rdservice-manager:1.3.0'
// (repositories: maven { url 'https://jitpack.io' })
class BiometricActivity : AppCompatActivity(), RDServiceEvents {

	private lateinit var rdServiceManager: RDServiceManager

	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		rdServiceManager = RDServiceManager.Builder(this).create()
		rdServiceManager.discoverRdService() // find installed RDService driver apps
	}

	// The library routes driver-app results back to you through this hook:
	override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
		super.onActivityResult(requestCode, resultCode, data)
		rdServiceManager.onActivityResult(requestCode, resultCode, data)
	}

	override fun onRDServiceDriverDiscovery(rdServiceInfo: String, rdServicePackage: String, isWhitelisted: Boolean) {
		// Driver found. Check <RDService status="READY"> in rdServiceInfo, then capture:
		val pidOptions = """<PidOptions ver="1.0"><Opts fCount="1" fType="2" format="0" pidVer="2.0" timeout="30000" otp="" posh="UNKNOWN" env="P" /></PidOptions>"""
		rdServiceManager.captureRdService(rdServicePackage, pidOptions)
	}

	override fun onRDServiceCaptureResponse(pidData: String, rdServicePackage: String) {
		// PID XML — check <Resp errCode="0">, then send to your backend as-is.
	}

	override fun onRDServiceDriverNotFound() { /* prompt: install driver from Play Store */ }
	override fun onRDServiceDriverDiscoveryFailed(resultCode: Int, intent: Intent?, pkg: String, info: String?) {}
	override fun onRDServiceCaptureFailed(resultCode: Int, intent: Intent?, pkg: String) {}
}`,
	},
	{
		language: "java",
		label: "Java",
		code: `// build.gradle: implementation 'com.github.ekoindia:android-uidai-rdservice-manager:1.3.0'
// (repositories: maven { url 'https://jitpack.io' })
public class BiometricActivity extends AppCompatActivity implements RDServiceEvents {

	private RDServiceManager rdServiceManager;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		rdServiceManager = new RDServiceManager.Builder(this).create();
		rdServiceManager.discoverRdService(); // find installed RDService driver apps
	}

	// The library routes driver-app results back to you through this hook:
	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		super.onActivityResult(requestCode, resultCode, data);
		rdServiceManager.onActivityResult(requestCode, resultCode, data);
	}

	@Override
	public void onRDServiceDriverDiscovery(String rdServiceInfo, String rdServicePackage, Boolean isWhitelisted) {
		// Driver found. Check <RDService status="READY"> in rdServiceInfo, then capture:
		String pidOptions = "<PidOptions ver=\\"1.0\\"><Opts fCount=\\"1\\" fType=\\"2\\" format=\\"0\\" pidVer=\\"2.0\\" timeout=\\"30000\\" otp=\\"\\" posh=\\"UNKNOWN\\" env=\\"P\\" /></PidOptions>";
		rdServiceManager.captureRdService(rdServicePackage, pidOptions);
	}

	@Override
	public void onRDServiceCaptureResponse(String pidData, String rdServicePackage) {
		// PID XML — check <Resp errCode="0">, then send to your backend as-is.
	}

	@Override
	public void onRDServiceDriverNotFound() { /* prompt: install driver from Play Store */ }
	@Override
	public void onRDServiceDriverDiscoveryFailed(int resultCode, Intent intent, String pkg, String info) {}
	@Override
	public void onRDServiceCaptureFailed(int resultCode, Intent intent, String pkg) {}
}`,
	},
];

/**
 * RSA-encrypt an Aadhaar number for the `aadhar` request param: UTF-8 →
 * RSA/PKCS#1 v1.5 with Eko's Base64 X.509 (SPKI) public key → Base64.
 * Shown on `/docs/aadhaar-number-encryption`; `code-snippet-sets.test.ts`
 * executes the Node.js variant against a throwaway key pair.
 */
const ENCRYPT_AADHAAR: CodeSnippet[] = [
	{
		language: "javascript",
		label: "Node.js",
		code: `import crypto from "node:crypto";

/** RSA-encrypt (PKCS#1 v1.5) a 12-digit Aadhaar number; returns Base64 ciphertext. */
export function encryptAadhaar(aadhaarNumber, rsaPublicKeyBase64) {
	if (!/^\\d{12}$/.test(aadhaarNumber)) throw new Error("Aadhaar must be exactly 12 digits");
	const encrypted = crypto.publicEncrypt(
		{
			key: Buffer.from(rsaPublicKeyBase64, "base64"), // Base64-encoded X.509 public key
			format: "der",
			type: "spki",
			padding: crypto.constants.RSA_PKCS1_PADDING,
		},
		Buffer.from(aadhaarNumber, "utf8"),
	);
	return encrypted.toString("base64"); // send as the \`aadhar\` param
}`,
	},
	{
		language: "python",
		label: "Python",
		code: `# pip install cryptography
import base64, re
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_der_public_key

def encrypt_aadhaar(aadhaar_number: str, rsa_public_key_base64: str) -> str:
    """RSA-encrypt (PKCS#1 v1.5) a 12-digit Aadhaar number; returns Base64 ciphertext."""
    if not re.fullmatch(r"\\d{12}", aadhaar_number):
        raise ValueError("Aadhaar must be exactly 12 digits")
    # Base64-encoded X.509 public key
    public_key = load_der_public_key(base64.b64decode(rsa_public_key_base64))
    encrypted = public_key.encrypt(aadhaar_number.encode("utf-8"), padding.PKCS1v15())
    return base64.b64encode(encrypted).decode("ascii")  # send as the \`aadhar\` param`,
	},
	{
		language: "php",
		label: "PHP",
		code: `<?php
/** RSA-encrypt (PKCS#1 v1.5) a 12-digit Aadhaar number; returns Base64 ciphertext. */
function encryptAadhaar(string $aadhaarNumber, string $rsaPublicKeyBase64): string
{
	if (!preg_match('/^\\d{12}$/', $aadhaarNumber)) {
		throw new InvalidArgumentException('Aadhaar must be exactly 12 digits');
	}
	// Wrap the Base64-encoded X.509 public key as PEM for OpenSSL
	$pem = "-----BEGIN PUBLIC KEY-----\\n"
		. chunk_split($rsaPublicKeyBase64, 64, "\\n")
		. "-----END PUBLIC KEY-----\\n";
	if (!openssl_public_encrypt($aadhaarNumber, $encrypted, $pem, OPENSSL_PKCS1_PADDING)) {
		throw new RuntimeException('Aadhaar encryption failed: ' . openssl_error_string());
	}
	return base64_encode($encrypted); // send as the \`aadhar\` param
}`,
	},
	{
		language: "java",
		label: "Java",
		code: `import javax.crypto.Cipher;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** RSA-encrypt (PKCS#1 v1.5) a 12-digit Aadhaar number; returns Base64 ciphertext. */
public static String encryptAadhaar(String aadhaarNumber, String rsaPublicKeyBase64) throws Exception {
	if (!aadhaarNumber.matches("\\\\d{12}")) {
		throw new IllegalArgumentException("Aadhaar must be exactly 12 digits");
	}
	// Base64-encoded X.509 public key
	byte[] publicKeyBytes = Base64.getDecoder().decode(rsaPublicKeyBase64);
	PublicKey publicKey = KeyFactory.getInstance("RSA")
		.generatePublic(new X509EncodedKeySpec(publicKeyBytes));

	// Name the padding explicitly — don't rely on the provider default for "RSA"
	Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
	cipher.init(Cipher.ENCRYPT_MODE, publicKey);
	byte[] encryptedBytes = cipher.doFinal(aadhaarNumber.getBytes(StandardCharsets.UTF_8));

	return Base64.getEncoder().encodeToString(encryptedBytes); // send as the \`aadhar\` param
}`,
	},
	{
		language: "csharp",
		label: "C#",
		code: `using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

/// <summary>RSA-encrypt (PKCS#1 v1.5) a 12-digit Aadhaar number; returns Base64 ciphertext.</summary>
static string EncryptAadhaar(string aadhaarNumber, string rsaPublicKeyBase64)
{
	if (!Regex.IsMatch(aadhaarNumber, @"^\\d{12}$"))
		throw new ArgumentException("Aadhaar must be exactly 12 digits");
	using var rsa = RSA.Create();
	// Base64-encoded X.509 (SubjectPublicKeyInfo) public key
	rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(rsaPublicKeyBase64), out _);
	byte[] encrypted = rsa.Encrypt(Encoding.UTF8.GetBytes(aadhaarNumber), RSAEncryptionPadding.Pkcs1);
	return Convert.ToBase64String(encrypted); // send as the \`aadhar\` param
}`,
	},
];

/** Named snippet sets addressable by `<CodeSnippets id="…" />`. */
export const CODE_SNIPPET_SETS: Record<string, CodeSnippet[]> = {
	"sign-request": SIGN_REQUEST,
	"rdservice-android": RDSERVICE_ANDROID,
	"encrypt-aadhaar": ENCRYPT_AADHAAR,
};

/** The snippets for a set, or `undefined` for an unknown id. */
export const getSnippetSet = (id: string): CodeSnippet[] | undefined =>
	CODE_SNIPPET_SETS[id];

/** The default (first) snippet of a set — the one the `.md` twin emits. */
export const defaultSnippet = (id: string): CodeSnippet | undefined =>
	CODE_SNIPPET_SETS[id]?.[0];
