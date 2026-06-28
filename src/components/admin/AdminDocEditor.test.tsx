import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDocEditor } from "./AdminDocEditor";
import { ApiError } from "@/lib/auth/client";

vi.mock("@uiw/react-codemirror", () => ({
	default: ({
		value,
		onChange,
	}: {
		value: string;
		onChange: (v: string) => void;
	}) => (
		<textarea
			aria-label="editor"
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	),
}));
vi.mock("@codemirror/lang-markdown", () => ({ markdown: () => [] }));

const getContent = vi.fn();
const propose = vi.fn();
vi.mock("@/lib/auth/client", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth/client")>(
			"@/lib/auth/client",
		);
	return {
		...actual,
		authClient: {
			adminDocs: {
				getContent: (...a: unknown[]) => getContent(...a),
				propose: (...a: unknown[]) => propose(...a),
			},
		},
	};
});

afterEach(() => vi.clearAllMocks());

describe("AdminDocEditor", () => {
	it("loads content and proposes a change → shows PR link", async () => {
		getContent.mockResolvedValue({
			content: "old",
			sha: "sha1",
			branch: "dev",
		});
		propose.mockResolvedValue({
			prUrl: "https://gh/pr/9",
			branch: "edit/docs-x-1",
			prNumber: 9,
		});
		render(<AdminDocEditor path="src/content/docs/x.mdx" />);
		const ta = (await screen.findByLabelText("editor")) as HTMLTextAreaElement;
		expect(ta.value).toBe("old");
		fireEvent.change(ta, { target: { value: "new body" } });
		fireEvent.change(screen.getByLabelText(/summary/i), {
			target: { value: "tighten" },
		});
		fireEvent.click(screen.getByRole("button", { name: /propose changes/i }));
		await waitFor(() =>
			expect(propose).toHaveBeenCalledWith({
				path: "src/content/docs/x.mdx",
				content: "new body",
				baseSha: "sha1",
				summary: "tighten",
			}),
		);
		expect(
			await screen.findByRole("link", { name: /pull request|pr #9|view pr/i }),
		).toHaveAttribute("href", "https://gh/pr/9");
	});

	it("maps STALE_CONTENT to a reload hint", async () => {
		getContent.mockResolvedValue({
			content: "old",
			sha: "sha1",
			branch: "dev",
		});
		propose.mockRejectedValue(
			new ApiError(
				"STALE_CONTENT",
				"Doc changed upstream — reload before saving",
				409,
			),
		);
		render(<AdminDocEditor path="src/content/docs/x.mdx" />);
		await screen.findByLabelText("editor");
		fireEvent.click(screen.getByRole("button", { name: /propose changes/i }));
		expect(await screen.findByText(/changed upstream/i)).toBeInTheDocument();
	});
});
