// design-sync preview provider: branded composites read react-router <Link>
// and some set <Helmet> meta. Wrap every preview so floor renders don't crash.
import type { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

export const DSProvider = ({ children }: { children?: ReactNode }) => (
	<HelmetProvider>
		<MemoryRouter>{children}</MemoryRouter>
	</HelmetProvider>
);
