import { afterEach, describe, expect, it, vi } from "vitest";
import { authClient } from "./client";

const okJson = (body: unknown) =>
	Promise.resolve(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);

afterEach(() => vi.restoreAllMocks());

describe("authClient.adminDocs", () => {
	it("list GETs /admin/docs", async () => {
		const f = vi
			.spyOn(globalThis, "fetch")
			.mockReturnValue(okJson({ docs: [] }) as ReturnType<typeof fetch>);
		await authClient.adminDocs.list();
		expect(f).toHaveBeenCalledWith(
			expect.stringContaining("/admin/docs"),
			expect.objectContaining({ method: "GET" }),
		);
	});
	it("getContent encodes the path", async () => {
		const f = vi
			.spyOn(globalThis, "fetch")
			.mockReturnValue(
				okJson({ content: "", sha: "s", branch: "dev" }) as ReturnType<
					typeof fetch
				>,
			);
		await authClient.adminDocs.getContent("src/content/docs/x.mdx");
		expect(f).toHaveBeenCalledWith(
			expect.stringContaining("path=src%2Fcontent%2Fdocs%2Fx.mdx"),
			expect.anything(),
		);
	});
	it("propose POSTs the payload", async () => {
		const f = vi
			.spyOn(globalThis, "fetch")
			.mockReturnValue(
				okJson({ prUrl: "u", branch: "b", prNumber: 1 }) as ReturnType<
					typeof fetch
				>,
			);
		await authClient.adminDocs.propose({
			path: "p",
			content: "c",
			baseSha: "s",
			summary: "x",
		});
		expect(f).toHaveBeenCalledWith(
			expect.stringContaining("/admin/docs/propose"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					path: "p",
					content: "c",
					baseSha: "s",
					summary: "x",
				}),
			}),
		);
	});
	it("deploy production POSTs", async () => {
		const f = vi
			.spyOn(globalThis, "fetch")
			.mockReturnValue(
				okJson({ prUrl: "u", prNumber: 2 }) as ReturnType<typeof fetch>,
			);
		await authClient.adminDeploy.production();
		expect(f).toHaveBeenCalledWith(
			expect.stringContaining("/admin/deploy/production"),
			expect.objectContaining({ method: "POST" }),
		);
	});
});
