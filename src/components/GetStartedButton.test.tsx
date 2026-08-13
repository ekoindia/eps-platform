// src/components/GetStartedButton.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openZohoChat = vi.fn();

/**
 * Imports the component fresh with `SHOW_USER_LOGIN` forced to `flag`.
 * The flag is a module-level const read at import time, so each branch needs
 * its own module registry.
 */
async function importWithFlag(flag: boolean) {
	vi.resetModules();
	vi.doMock("@/lib/config/features", () => ({ SHOW_USER_LOGIN: flag }));
	vi.doMock("@/lib/zoho-chat", () => ({ openZohoChat }));
	return (await import("@/components/GetStartedButton")).GetStartedButton;
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.doUnmock("@/lib/config/features");
	vi.doUnmock("@/lib/zoho-chat");
});

describe("GetStartedButton with SHOW_USER_LOGIN on", () => {
	it("links to /console using consoleLabel, without opening chat", async () => {
		const GetStartedButton = await importWithFlag(true);
		render(
			<MemoryRouter>
				<GetStartedButton consoleLabel="Log in / Sign up">
					Get Started
				</GetStartedButton>
			</MemoryRouter>,
		);

		const link = screen.getByRole("link", { name: "Log in / Sign up" });
		expect(link).toHaveAttribute("href", "/console");
		expect(screen.queryByText("Get Started")).not.toBeInTheDocument();

		fireEvent.click(link);
		expect(openZohoChat).not.toHaveBeenCalled();
	});

	it("falls back to children when no consoleLabel is given", async () => {
		const GetStartedButton = await importWithFlag(true);
		render(
			<MemoryRouter>
				<GetStartedButton>Get Started</GetStartedButton>
			</MemoryRouter>,
		);

		expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
			"href",
			"/console",
		);
	});

	it("still runs onClick, so a mobile sheet or dropdown closes", async () => {
		const GetStartedButton = await importWithFlag(true);
		const onClick = vi.fn();
		render(
			<MemoryRouter>
				<GetStartedButton onClick={onClick}>Get Started</GetStartedButton>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("link", { name: "Get Started" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});

describe("GetStartedButton with SHOW_USER_LOGIN off", () => {
	it("opens the Zoho chat and renders no link", async () => {
		const GetStartedButton = await importWithFlag(false);
		render(
			<MemoryRouter>
				<GetStartedButton consoleLabel="Log in / Sign up">
					Get Started
				</GetStartedButton>
			</MemoryRouter>,
		);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
		expect(openZohoChat).toHaveBeenCalledTimes(1);
	});

	it("runs onClick before opening the chat", async () => {
		const GetStartedButton = await importWithFlag(false);
		const calls: string[] = [];
		render(
			<MemoryRouter>
				<GetStartedButton onClick={() => calls.push("onClick")}>
					Get Started
				</GetStartedButton>
			</MemoryRouter>,
		);
		openZohoChat.mockImplementation(() => calls.push("chat"));

		fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
		expect(calls).toEqual(["onClick", "chat"]);
	});
});
