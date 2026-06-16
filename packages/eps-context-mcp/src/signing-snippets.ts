export const SIGNING_LANGUAGES = [
	"php",
	"java",
	"csharp",
	"javascript",
	"python",
	"go",
] as const;
export type SigningLanguage = (typeof SIGNING_LANGUAGES)[number];

const SNIPPETS: Record<SigningLanguage, string> = {
	php: `<?php
// Backend only. Never expose access_key in a browser.
$accessKey = getenv('EKO_ACCESS_KEY');
$timestamp = (string) round(microtime(true) * 1000);
$encodedKey = base64_encode($accessKey);
$secretKey = base64_encode(hash_hmac('sha256', $timestamp, $encodedKey, true));
// Send headers: developer_key, secret-key: $secretKey, secret-key-timestamp: $timestamp
`,
	java: `// Backend only. Never expose access_key in a browser.
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

String accessKey = System.getenv("EKO_ACCESS_KEY");
String timestamp = String.valueOf(System.currentTimeMillis());
String encodedKey = Base64.getEncoder().encodeToString(accessKey.getBytes("UTF-8"));
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(encodedKey.getBytes("UTF-8"), "HmacSHA256"));
String secretKey = Base64.getEncoder().encodeToString(mac.doFinal(timestamp.getBytes("UTF-8")));
`,
	csharp: `// Backend only. Never expose access_key in a browser.
using System;
using System.Security.Cryptography;
using System.Text;

string accessKey = Environment.GetEnvironmentVariable("EKO_ACCESS_KEY");
string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
string encodedKey = Convert.ToBase64String(Encoding.UTF8.GetBytes(accessKey));
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(encodedKey));
string secretKey = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp)));
`,
	javascript: `// Backend only (Node.js). Never expose access_key in a browser.
import crypto from "node:crypto";

const accessKey = process.env.EKO_ACCESS_KEY;
const timestamp = Date.now().toString();
const encodedKey = Buffer.from(accessKey).toString("base64");
const secretKey = crypto
	.createHmac("sha256", encodedKey)
	.update(timestamp)
	.digest("base64");
// headers: { developer_key, "secret-key": secretKey, "secret-key-timestamp": timestamp }
`,
	python: `# Backend only. Never expose access_key in a browser.
import base64, hashlib, hmac, os, time

access_key = os.environ["EKO_ACCESS_KEY"]
timestamp = str(int(time.time() * 1000))
encoded_key = base64.b64encode(access_key.encode())
secret_key = base64.b64encode(
	hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
).decode()
`,
	go: `// Backend only. Never expose access_key in a browser.
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"time"
)

func secretKey() (string, string) {
	accessKey := os.Getenv("EKO_ACCESS_KEY")
	timestamp := fmt.Sprintf("%d", time.Now().UnixMilli())
	encodedKey := base64.StdEncoding.EncodeToString([]byte(accessKey))
	mac := hmac.New(sha256.New, []byte(encodedKey))
	mac.Write([]byte(timestamp))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), timestamp
}
`,
};

export const getSigningSnippet = (language: string): string =>
	(SNIPPETS as Record<string, string>)[language] ??
	`Unsupported language "${language}". Supported: ${SIGNING_LANGUAGES.join(", ")}.`;
