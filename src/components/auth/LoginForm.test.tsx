import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const refresh = vi.fn();
const adopt = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ refresh, adopt }),
}));
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

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe("LoginForm", () => {
	it("walks mobile → OTP and adopts the verify response without refetching /me", async () => {
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
		// The verify response IS the /me view, so the session is adopted from it.
		// A refresh() here would be a second round-trip on the login path.
		expect(adopt).toHaveBeenCalledWith({ state: "active" });
		expect(refresh).not.toHaveBeenCalled();
	});

	it("warms the next route's chunk once the OTP step appears, and only once", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		const prefetch = vi.fn().mockResolvedValue({});
		render(<LoginForm prefetch={prefetch} />);
		// Nothing warmed while the user is still typing their number.
		expect(prefetch).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

		await waitFor(() => expect(prefetch).toHaveBeenCalledTimes(1));
		// A re-render (here, the resend countdown ticking) must not re-fire it.
		await waitFor(() => expect(prefetch).toHaveBeenCalledTimes(1));
	});

	it("survives a prefetch that rejects", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		const prefetch = vi.fn().mockRejectedValue(new Error("chunk 404"));
		render(<LoginForm prefetch={prefetch} />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		// The OTP step still renders; a failed warm-up is not a failed login.
		expect(await screen.findByLabelText(/digit 1/i)).toBeInTheDocument();
	});

	it("labels the mobile submit 'Send OTP' by default and honours submitLabel", () => {
		const { unmount } = render(<LoginForm />);
		expect(
			screen.getByRole("button", { name: "Send OTP" }),
		).toBeInTheDocument();
		unmount();

		render(<LoginForm submitLabel="Continue with mobile OTP" />);
		expect(
			screen.getByRole("button", { name: "Continue with mobile OTP" }),
		).toBeInTheDocument();
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

	it("remembers the verified number and prefills it next time", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		(authClient.verifyOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			role: "signup",
		});
		const { unmount } = render(<LoginForm />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		"1111"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		await waitFor(() =>
			expect(localStorage.getItem("eko-last-mobile")).toBe("9990000001"),
		);
		unmount();

		render(<LoginForm />);
		// digitGroups formats the display; the button gate reads the raw value.
		expect(await screen.findByDisplayValue("999 000 0001")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /send otp/i })).toBeEnabled();
	});

	it("does not remember a number whose OTP failed", async () => {
		(authClient.startOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		(authClient.verifyOtp as ReturnType<typeof vi.fn>).mockRejectedValue(
			new ApiError("OTP_INVALID", "Invalid or expired OTP", 401),
		);
		render(<LoginForm />);
		fireEvent.change(screen.getByLabelText(/mobile/i), {
			target: { value: "9990000002" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
		const boxes = await screen.findAllByLabelText(/^Digit \d/);
		"0000"
			.split("")
			.forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
		await screen.findByText(/invalid or expired otp/i);
		expect(localStorage.getItem("eko-last-mobile")).toBeNull();
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
