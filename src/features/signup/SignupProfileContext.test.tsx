import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	SignupProfileProvider,
	useSignupProfile,
} from "./SignupProfileContext";

describe("SignupProfileContext", () => {
	it("exposes the provided profile to consumers", () => {
		function Probe() {
			const p = useSignupProfile();
			return <span>{`${p.mobile}|${p.name ?? ""}|${p.email ?? ""}`}</span>;
		}
		render(
			<SignupProfileProvider
				profile={{
					mobile: "9990000001",
					name: "Asha Rao",
					email: "asha@acme.in",
				}}
			>
				<Probe />
			</SignupProfileProvider>,
		);
		expect(
			screen.getByText("9990000001|Asha Rao|asha@acme.in"),
		).toBeInTheDocument();
	});

	it("throws when used outside a provider", () => {
		expect(() => renderHook(() => useSignupProfile())).toThrow(
			/SignupProfileProvider/,
		);
	});
});
