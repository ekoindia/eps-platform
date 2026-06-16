/**
 * Client-only singleton for the docs "Try it" Scalar modal.
 *
 * Mirrors what @scalar/api-client-react does internally, but lets us pass our
 * HMAC signing plugin — the react wrapper does not forward `plugins`, and signing
 * MUST happen in a `beforeRequest` plugin (this build does not execute
 * `x-pre-request` scripts).
 *
 * IMPORTANT: this module pulls in the Vue-based client and its CSS, so it must be
 * dynamically imported in the browser only — never from code that runs during
 * SSR/prerender. See `useTryIt`.
 */
import "@scalar/api-client/style.css";
import {
	type ApiClientModal,
	createApiClientModal,
	type RoutePayload,
} from "@scalar/api-client/modal";
import { createWorkspaceStore } from "@scalar/workspace-store/client";
import { createWorkspaceEventBus } from "@scalar/workspace-store/events";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { ekoSigningPlugin } from "@/lib/docs/eko-signing-plugin";
import { resolveTryItProxyUrl } from "@/lib/docs/tryit-proxy";
import { buildOpenApiDocument } from "@/lib/openapi/build-openapi";

/** Workspace document slug — also passed to `open()` so routing is unambiguous. */
const DOC_NAME = "eko-eps";

/**
 * DEV-only credential prefill for the Scalar auth panel. `import.meta.env.DEV` is
 * false during the Node prerender and in production builds, so these never reach
 * static output. Returns undefined when no creds are configured.
 */
const devAuthentication = () => {
	if (!import.meta.env.DEV) return undefined;
	const developerKey = import.meta.env.VITE_EPS_UAT_DEVELOPER_KEY ?? "";
	const accessKey = import.meta.env.VITE_EPS_UAT_ACCESS_KEY ?? "";
	if (!developerKey && !accessKey) return undefined;
	return {
		// AND tuple: keep both auth fields active in the panel.
		preferredSecurityScheme: [["developerKey", "accessKey"]],
		securitySchemes: {
			developerKey: { value: developerKey },
			accessKey: { value: accessKey },
		},
	};
};

let modalPromise: Promise<ApiClientModal> | undefined;

const createModal = async (): Promise<ApiClientModal> => {
	const el = document.createElement("div");
	// `scalar-app` is the client's style root; `dark-mode` activates Scalar's
	// theme CSS variables (defined under `.light-mode` / `.dark-mode`). Without a
	// mode class the variables are unset and every panel renders transparent.
	el.className = "scalar-app dark-mode";
	document.body.appendChild(el);

	const workspaceStore = createWorkspaceStore();
	const eventBus = createWorkspaceEventBus();

	const modal = createApiClientModal({
		el,
		eventBus,
		workspaceStore,
		plugins: [ekoSigningPlugin],
		options: {
			proxyUrl: resolveTryItProxyUrl(),
			authentication: devAuthentication(),
		},
	});

	await workspaceStore.addDocument({
		name: DOC_NAME,
		document: buildOpenApiDocument(getDocumentedSpecs(), {
			interactive: true,
		}) as unknown as Record<string, unknown>,
	});

	return modal;
};

/** Lazily create the page-lifetime modal singleton (browser only). */
const getTryItModal = (): Promise<ApiClientModal> => {
	modalPromise ??= createModal().catch((error) => {
		modalPromise = undefined; // allow retry on next call
		throw error;
	});
	return modalPromise;
};

/** Open the Try-it modal scoped to a single operation. */
export const openTryIt = async (
	path: string,
	method: string,
): Promise<void> => {
	const modal = await getTryItModal();
	modal.open({
		path,
		method: method.toLowerCase() as RoutePayload["method"],
		documentSlug: DOC_NAME,
	});
};
