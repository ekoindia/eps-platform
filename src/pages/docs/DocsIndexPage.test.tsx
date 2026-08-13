// Regression: arriving at /docs#sdk preselects the SDK path, but the selection
// must stay changeable. It used to snap back because the hash effect depended on
// an unmemoized setter from useDocsMode and so re-ran on every render.
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import DocsIndexPage from "./DocsIndexPage";

// AuthProvider: the page's Footer consumes useAuth. Its mount-time session probe
// fails harmlessly without a fetch backend, leaving the anonymous state.
const renderAt = (entry: string) =>
	render(
		<HelmetProvider>
			<MemoryRouter initialEntries={[entry]}>
				<AuthProvider>
					<DocsIndexPage />
				</AuthProvider>
			</MemoryRouter>
		</HelmetProvider>,
	);

const pathCard = (name: RegExp) => screen.getByRole("radio", { name });

describe("DocsIndexPage path chooser", () => {
	beforeEach(() => localStorage.clear());

	it("preselects the mode named by the hash", () => {
		renderAt("/docs#ai");
		expect(pathCard(/Build with AI/)).toBeChecked();
		expect(pathCard(/Use an SDK/)).not.toBeChecked();
	});

	it("ignores a hash that is not a mode", () => {
		localStorage.setItem("eko-docs-mode", "api");
		renderAt("/docs#quickstart");
		expect(pathCard(/Call the API directly/)).toBeChecked();
	});

	it("lets the visitor switch away from the hash-selected mode", () => {
		renderAt("/docs#sdk");
		expect(pathCard(/Use an SDK/)).toBeChecked();

		fireEvent.click(pathCard(/Call the API directly/));
		expect(pathCard(/Call the API directly/)).toBeChecked();
		expect(pathCard(/Use an SDK/)).not.toBeChecked();
		expect(localStorage.getItem("eko-docs-mode")).toBe("api");

		fireEvent.click(pathCard(/Build with AI/));
		expect(pathCard(/Build with AI/)).toBeChecked();
		expect(localStorage.getItem("eko-docs-mode")).toBe("ai");
	});
});
