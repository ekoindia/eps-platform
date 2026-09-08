import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import { TRYIT_PROXY_URL } from "@/lib/docs/tryit-request";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TryItDialog from "./TryItDialog";

vi.mock("@/lib/uat-credentials", () => ({
	uatCredentials: () => ({
		developerKey: "demo-dev",
		accessKey: "demo-access",
	}),
}));

const spec = API_SPECS_MAP["pan-lite"] ?? Object.values(API_SPECS_MAP)[0];
const financialSpec = {
	...spec,
	id: "fin-test",
	financial: true,
} as ApiSpec;

const proxied = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "x-eps-proxied": "1" },
	});

const fetchMock = vi.fn();
const lastCall = () =>
	fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined;

const renderDialog = (s: ApiSpec = spec) =>
	render(<TryItDialog spec={s} open onOpenChange={() => {}} />);

const send = () =>
	fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

beforeEach(() => {
	sessionStorage.clear();
	fetchMock.mockReset().mockResolvedValue(proxied({ status: 0, data: {} }));
	vi.stubGlobal("fetch", fetchMock);
	document.documentElement.classList.remove("docs-dark");
});
afterEach(() => vi.unstubAllGlobals());

describe("TryItDialog", () => {
	it("shows breadcrumb, method and the UAT URL, with demo keys prefilled and masked", () => {
		renderDialog();
		expect(screen.getAllByText(spec.name).length).toBeGreaterThan(0);
		expect(screen.getByText(spec.method)).toBeInTheDocument();
		expect(
			screen.getByText((t) => t.startsWith(API_ENVIRONMENTS.sandbox.baseUrl)),
		).toBeInTheDocument();
		expect(screen.getByLabelText("developer_key")).toHaveValue("demo-dev");
		const access = screen.getByLabelText("access_key") as HTMLInputElement;
		expect(access.value).toBe("demo-access");
		expect(access.type).toBe("password");
	});

	it("signs at send and posts to the proxy without the access key", async () => {
		renderDialog();
		send();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url, init] = lastCall()!;
		expect(url).toBe(TRYIT_PROXY_URL);
		const headers = init.headers as Record<string, string>;
		expect(headers["x-eps-developer-key"]).toBe("demo-dev");
		expect(headers["x-eps-target-method"]).toBe(spec.method);
		expect(
			headers["x-eps-target-url"].startsWith(API_ENVIRONMENTS.sandbox.baseUrl),
		).toBe(true);
		expect(headers["secret-key"]).toBeTruthy();
		expect(JSON.stringify(headers)).not.toContain("demo-access");
		expect(headers.access_key).toBeUndefined();
		expect(await screen.findByText("200")).toBeInTheDocument();
		expect(screen.getByText(/Eko: success/i)).toBeInTheDocument();
	});

	it("regenerates client_ref_id on every send", async () => {
		renderDialog();
		send();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const first = JSON.parse(lastCall()![1].body as string).client_ref_id;
		await screen.findByText("200");
		send();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const second = JSON.parse(lastCall()![1].body as string).client_ref_id;
		expect(first).toMatch(/^[0-9a-z]{15}$/);
		expect(second).not.toBe(first);
	});

	it("shows the UAT callout and Eko failure badge on status !== 0", async () => {
		fetchMock.mockResolvedValue(
			proxied({ status: 97, message: "Please provide the value of the field" }),
		);
		renderDialog();
		send();
		expect(await screen.findByText(/Eko: failure/i)).toBeInTheDocument();
		expect(screen.getByText(/UAT test failed\?/i)).toBeInTheDocument();
	});

	it("surfaces a proxy error instead of a response when x-eps-proxied is missing", async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error: { code: "RATE_LIMITED", message: "slow down" },
				}),
				{
					status: 429,
					headers: { "content-type": "application/json" },
				},
			),
		);
		renderDialog();
		send();
		expect(
			await screen.findByText("RATE_LIMITED: slow down"),
		).toBeInTheDocument();
		expect(screen.queryByText("429")).not.toBeInTheDocument();
	});

	it("switching to Production clears the demo keys, shows the banner and blocks Send", async () => {
		renderDialog();
		fireEvent.click(
			screen.getByRole("tab", { name: API_ENVIRONMENTS.production.label }),
		);
		expect(screen.getByLabelText("developer_key")).toHaveValue("");
		expect(screen.getByText(/^Production\./)).toBeInTheDocument();
		send();
		expect(
			await screen.findByText(/Enter your production/),
		).toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("financial + production needs a second click, and an edit disarms", async () => {
		renderDialog(financialSpec);
		fireEvent.click(
			screen.getByRole("tab", { name: API_ENVIRONMENTS.production.label }),
		);
		fireEvent.change(screen.getByLabelText("developer_key"), {
			target: { value: "d" },
		});
		fireEvent.change(screen.getByLabelText("access_key"), {
			target: { value: "a" },
		});
		send();
		const confirm = await screen.findByRole("button", {
			name: /confirm production send/i,
		});
		expect(fetchMock).not.toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText("developer_key"), {
			target: { value: "dd" },
		});
		expect(
			screen.queryByRole("button", { name: /confirm production send/i }),
		).not.toBeInTheDocument();
		send();
		await screen.findByRole("button", { name: /confirm production send/i });
		fireEvent.click(confirm);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	});

	it("blocks Send on invalid raw JSON and keeps the draft", async () => {
		renderDialog();
		fireEvent.click(screen.getByRole("tab", { name: "Raw JSON" }));
		const raw = screen.getByLabelText("Raw JSON body") as HTMLTextAreaElement;
		fireEvent.change(raw, { target: { value: "{ nope" } });
		expect(raw.value).toBe("{ nope");
		send();
		expect(
			await screen.findByText(/Fix the JSON body first/),
		).toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("persists the request per spec without credentials and restores it", async () => {
		const { unmount } = renderDialog();
		fireEvent.click(screen.getByRole("tab", { name: "Raw JSON" }));
		fireEvent.change(screen.getByLabelText("Raw JSON body"), {
			target: {
				value: JSON.stringify({ pan: "ABCDE1234F", access_key: "leak" }),
			},
		});
		await waitFor(() => {
			const saved = sessionStorage.getItem(`eko-tryit:${spec.id}`);
			expect(saved).toContain("ABCDE1234F");
			expect(saved).not.toContain("leak");
			expect(saved).not.toContain("demo-access");
		});
		unmount();
		renderDialog();
		expect(
			(screen.getByLabelText("Raw JSON body") as HTMLTextAreaElement).value,
		).toContain("ABCDE1234F");
	});

	it("a restored production session starts with empty credentials", () => {
		sessionStorage.setItem(
			`eko-tryit:${spec.id}`,
			JSON.stringify({ env: "production" }),
		);
		renderDialog();
		expect(screen.getByLabelText("developer_key")).toHaveValue("");
	});

	it("Ctrl+Enter sends", async () => {
		renderDialog();
		fireEvent.keyDown(screen.getByRole("dialog"), {
			key: "Enter",
			ctrlKey: true,
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	});

	it("follows the docs dark flag on <html>", () => {
		document.documentElement.classList.add("docs-dark");
		renderDialog();
		expect(screen.getByRole("dialog")).toHaveClass("dark");
	});
});
