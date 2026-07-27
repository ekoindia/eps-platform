import { ConnectWidget } from "@/components/connect/ConnectWidget";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { clearConnectTokens } from "@/lib/connect/token";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_CONNECT_WIDGET: true,
	CONNECT_WIDGET_URL: "https://beta.ekoconnect.in",
}));

// jsdom cannot load an HTML import; the runtime is exercised in a real browser.
vi.mock("@/lib/connect/runtime", () => ({
	loadConnectRuntime: async () => undefined,
}));

const LOAD_EVALUE = {
	id: 491,
	interaction_type_id: 0,
	behavior: 7,
	group_interaction_ids: "315,92,240",
	label: "Load E-value",
};

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: {
		connectToken: async () => ({
			accessTokenLite: "lite",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		}),
		connectInteractions: async () => ({ interactions: [LOAD_EVALUE] }),
		refresh: async () => ({ ok: true }),
	},
}));

beforeEach(() => {
	resetRoleTransactionCache();
	clearConnectTokens();
	sessionStorage.clear();
});

/** Renders the widget and resolves once the custom element is in the DOM. */
async function mountWidget() {
	const { container } = render(
		<MemoryRouter>
			<ConnectWidget interactionId={491} paths={[]} />
		</MemoryRouter>,
	);
	const el = await waitFor(() => {
		const found = container.querySelector("tf-wlc-widget");
		expect(found).not.toBeNull();
		return found as HTMLElement & Record<string, unknown>;
	});
	return el;
}

describe("ConnectWidget", () => {
	it("hands role_trxn_list to the widget as an object, not a JSON string", async () => {
		const el = await mountWidget();

		// Regression: React 19 assigns properties on custom elements, so a
		// JSON.stringify'd value lands as a raw string and the widget's
		// `interaction_id in role_trxn_list` throws "Cannot use 'in' operator".
		await waitFor(() => expect(el.role_trxn_list).toBeTypeOf("object"));
		expect(el.role_trxn_list).toHaveProperty("491");
	});

	it("keeps the grid children the flow needs", async () => {
		const el = await mountWidget();

		// 491 is behavior 7 — a grid rendered from group_interaction_ids.
		await waitFor(() =>
			expect(
				(
					el.role_trxn_list as Record<
						string,
						{ group_interaction_ids?: string }
					>
				)?.["491"]?.group_interaction_ids,
			).toBe("315,92,240"),
		);
	});

	it("passes route_params as an object", async () => {
		const el = await mountWidget();

		await waitFor(() =>
			expect(el.route_params).toEqual({ trxntypeid: 491, subpath_list: [] }),
		);
	});

	it("writes the widget's credentials before it can call out", async () => {
		await mountWidget();

		await waitFor(() =>
			expect(sessionStorage.getItem("access_token_lite")).toBe("lite"),
		);
	});

	it("clears those credentials on unmount", async () => {
		const { unmount } = render(
			<MemoryRouter>
				<ConnectWidget interactionId={491} paths={[]} />
			</MemoryRouter>,
		);
		await waitFor(() =>
			expect(sessionStorage.getItem("access_token_lite")).toBe("lite"),
		);

		unmount();

		expect(sessionStorage.getItem("access_token_lite")).toBeNull();
	});
});
