import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ekoSigningPlugin } from "@/lib/docs/eko-signing-plugin";

/** Independent reference: base64(HMAC-SHA256(timestamp, base64(access_key))). */
const ref = (message: string, accessKey: string): string =>
	createHmac("sha256", Buffer.from(accessKey).toString("base64"))
		.update(message)
		.digest("base64");

interface SecurityEntry {
	in: "header" | "query" | "cookie";
	name: string;
	value: string;
}

/** Minimal RequestFactory stub matching the fields the plugin touches. */
const makeBuilder = (security: SecurityEntry[]) => ({
	security,
	options: {} as Record<string, unknown>,
	headers: new Headers(),
});

const runBeforeRequest = async (
	builder: ReturnType<typeof makeBuilder>,
): Promise<void> => {
	const beforeRequest = ekoSigningPlugin.hooks?.beforeRequest;
	if (!beforeRequest) throw new Error("plugin has no beforeRequest hook");
	await beforeRequest({ requestBuilder: builder } as never);
};

describe("ekoSigningPlugin.beforeRequest", () => {
	it("signs from the security schemes and never emits access_key", async () => {
		const builder = makeBuilder([
			{ in: "header", name: "developer_key", value: "dev" },
			{ in: "header", name: "access_key", value: "acc" },
		]);
		await runBeforeRequest(builder);

		// Built-in security handling is taken over so the raw access_key is not added.
		expect(builder.options.disableSecurity).toBe(true);
		// access_key is never written as a header.
		expect(builder.headers.has("access_key")).toBe(false);
		// developer_key is re-applied manually (since security is disabled).
		expect(builder.headers.get("developer_key")).toBe("dev");

		const timestamp = builder.headers.get("secret-key-timestamp");
		expect(timestamp).toMatch(/^\d+$/);
		expect(builder.headers.get("secret-key")).toBe(
			ref(timestamp as string, "acc"),
		);
	});

	it("is a no-op when no access_key scheme is present", async () => {
		const builder = makeBuilder([
			{ in: "header", name: "developer_key", value: "dev" },
		]);
		await runBeforeRequest(builder);

		expect(builder.options.disableSecurity).toBeUndefined();
		expect(builder.headers.has("secret-key")).toBe(false);
		expect(builder.headers.has("developer_key")).toBe(false);
	});
});
