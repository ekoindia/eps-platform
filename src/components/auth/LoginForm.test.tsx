import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const refresh = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ refresh }) }));
vi.mock("@/lib/auth/client", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth/client")>(
			"@/lib/auth/client",
		);
	return { ...actual, authClient: { startOtp: vi.fn(), verifyOtp: vi.fn() } };
});
import { authClient, ApiError } from "@/lib/auth/client";

afterEach(() => vi.clearAllMocks());

describe("LoginForm", () => {
	it("walks mobile → OTP and calls refresh + onSuccess on success", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		(authClient.verifyOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			state: "active",
		});
		const onSuccess = vi.fn();
		render(<LoginForm onSuccess={onSuccess} />);

		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		await waitFor(() =>
			expect(authClient.startOtp).toHaveBeenCalledWith("9990000001"),
		);

		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		"111111"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		// Filling all six boxes auto-submits — no Verify click needed.
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(refresh).toHaveBeenCalled();
	});

	it("shows the envelope message on a wrong OTP", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		(authClient.verifyOtp as ReturnType<typeof vi.fn>).mockRejectedValue(
			new ApiError("OTP_INVALID", "Invalid or expired OTP", 401),
		);
		render(<LoginForm />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		"000000"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		expect(
			await screen.findByText(/invalid or expired otp/i),
		).toBeInTheDocument();
	});
});
