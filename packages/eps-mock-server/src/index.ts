#!/usr/bin/env node
import { createMockServer, loadFixtures } from "./server.js";

const port = Number(process.env.PORT ?? 4010);
const fixtures = await loadFixtures();
createMockServer(fixtures).listen(port, () => {
	console.error(
		`eps-mock-server listening on http://localhost:${port} (${fixtures.length} endpoints)`,
	);
});
