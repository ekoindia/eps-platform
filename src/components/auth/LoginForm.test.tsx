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
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
	toast: { info: (...a: unknown[]) => toastInfo(...a) },
}));
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
		"1111"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		// Filling all boxes auto-submits — no Verify click needed.
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(refresh).toHaveBeenCalled();
	});

	it("submits the mobile step on Enter, but only once the number is complete", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		const { container } = render(<LoginForm />);
		const form = container.querySelector("form")!;

		// jsdom doesn't implement the browser's implicit submission, so the Enter
		// keypress is stood in for by the submit event it would produce.
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "99900" },
		});
		fireEvent.submit(form);
		expect(authClient.startOtp).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.submit(form);
		await waitFor(() =>
			expect(authClient.startOtp).toHaveBeenCalledWith("9990000001"),
		);
	});

	it("toasts the demo OTP when the backend echoes one", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			otp: "4723",
		});
		render(<LoginForm />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		await waitFor(() =>
			expect(toastInfo).toHaveBeenCalledWith(
				"Demo OTP: 4723",
				expect.anything(),
			),
		);
	});

	it("auto-submits a pasted OTP", async () => {
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
		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		fireEvent.paste(boxes[0], {
			clipboardData: { getData: () => "4723" },
		});
		await waitFor(() =>
			expect(authClient.verifyOtp).toHaveBeenCalledWith("9990000001", "4723"),
		);
		expect(onSuccess).toHaveBeenCalled();
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
		"0000"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		expect(
			await screen.findByText(/invalid or expired otp/i),
		).toBeInTheDocument();
	});

	it("shows the deny message and grants no session for a non-EPS-business account", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		(authClient.verifyOtp as ReturnType<typeof vi.fn>).mockRejectedValue(
			new ApiError(
				"NOT_ALLOWED",
				"This account isn't an EPS business account. Please contact support.",
				403,
			),
		);
		const onSuccess = vi.fn();
		render(<LoginForm onSuccess={onSuccess} />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		"1111"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		expect(
			await screen.findByText(/isn't an EPS business account/i),
		).toBeInTheDocument();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
	});
});
