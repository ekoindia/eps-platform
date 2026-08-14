import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SignInSplit } from "@/components/auth/SignInSplit";

// Echo the props back so the forwarding — the only behaviour this component has
// — is observable. `prefetch` is a thunk, so its identity is what matters.
const loginFormProps = vi.fn();
vi.mock("@/components/auth/LoginForm", () => ({
	LoginForm: (props: Record<string, unknown>) => {
		loginFormProps(props);
		return <div data-testid="login-form" />;
	},
}));

function renderSplit(props: Parameters<typeof SignInSplit>[0] = {}) {
	return render(
		<MemoryRouter>
			<SignInSplit {...props} />
		</MemoryRouter>,
	);
}

describe("SignInSplit", () => {
	it("forwards onSuccess and prefetch to the form, and names the OTP method", () => {
		const onSuccess = vi.fn();
		const prefetch = vi.fn();
		renderSplit({ onSuccess, prefetch });

		expect(screen.getByTestId("login-form")).toBeInTheDocument();
		expect(loginFormProps).toHaveBeenCalledWith({
			onSuccess,
			prefetch,
			submitLabel: "Continue with mobile OTP",
		});
	});

	it("numbers the four required steps under one h1", () => {
		renderSplit();

		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

		const steps = screen.getAllByRole("listitem");
		expect(steps).toHaveLength(4);
		const titles = [
			"Finish your quick signup to get started",
			"Build your integration in hours, not weeks",
			"Finish your KYC to receive production credentials",
			"Run your business from the dashboard",
		];
		// Label and title have to be in the same item, or the renumbering is a lie.
		titles.forEach((title, i) => {
			const step = within(steps[i]);
			expect(step.getByText(title)).toBeInTheDocument();
			expect(
				step.getByText(`Step ${String(i + 1).padStart(2, "0")}`),
			).toBeInTheDocument();
		});
		expect(
			screen.getByText(/receive your UAT credentials/),
		).toBeInTheDocument();
	});

	// The API trial is a detour off step 1, not a step: no number, and inside the
	// first list item so the journey still reads as four steps.
	it("renders the API trial as an optional card on step 1", () => {
		renderSplit();

		const trial = within(
			screen.getByRole("complementary", { name: /optional/i }),
		);
		expect(trial.getByText("Optional")).toBeInTheDocument();
		expect(trial.getByText(/after\s*signup/)).toBeInTheDocument();
		expect(
			trial.getByText("Try verification APIs live before you build"),
		).toBeInTheDocument();
		expect(trial.getByText(/zero code\./)).toBeInTheDocument();
		expect(screen.queryByText("05")).toBeNull();
	});

	it("links the legal line at the real policy routes", () => {
		renderSplit();

		expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute(
			"href",
			"/tnc",
		);
		expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute(
			"href",
			"/privacy-policy",
		);
	});

	// Mobile OTP is the only method the backend supports; the source design also
	// offered Google and GitHub, and shipping dead social buttons would be worse
	// than shipping none.
	it("offers no social sign-in", () => {
		renderSplit();

		expect(screen.queryByText(/continue with google/i)).toBeNull();
		expect(screen.queryByText(/continue with github/i)).toBeNull();
	});
});
