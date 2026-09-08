import { API_SPECS_MAP } from "@/lib/data/api-specs";
import {
	act,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTryIt } from "./useTryIt";

const spec = Object.values(API_SPECS_MAP)[0];

const dialogSpy = vi.fn();
vi.mock("./tryit/TryItDialog", () => ({
	default: (props: { open: boolean }) => {
		dialogSpy(props);
		return props.open ? <div data-testid="dialog" /> : null;
	},
}));

const Host = () => {
	const { onTest, dialog } = useTryIt(spec);
	return (
		<>
			<button type="button" onClick={onTest}>
				test
			</button>
			{dialog}
		</>
	);
};

afterEach(() => {
	window.history.replaceState(null, "", "/");
	dialogSpy.mockClear();
});

describe("useTryIt", () => {
	it("yields no onTest for guides (no spec)", () => {
		const { result } = renderHook(() => useTryIt(undefined));
		expect(result.current.onTest).toBeUndefined();
		expect(result.current.dialog).toBeNull();
	});

	it("does not load the dialog until the button is clicked", async () => {
		render(<Host />);
		expect(dialogSpy).not.toHaveBeenCalled();
		act(() => screen.getByText("test").click());
		expect(await screen.findByTestId("dialog")).toBeInTheDocument();
	});

	it("opens on mount when ?try=1 is in the URL", async () => {
		window.history.replaceState(null, "", "/docs/x?try=1");
		render(<Host />);
		await waitFor(() =>
			expect(screen.getByTestId("dialog")).toBeInTheDocument(),
		);
	});
});
