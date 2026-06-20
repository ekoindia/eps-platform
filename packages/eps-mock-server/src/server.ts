import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchResponse, type Fixture } from "./match.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const loadFixtures = async (): Promise<Fixture[]> =>
	JSON.parse(
		await fs.readFile(path.resolve(here, "../data/fixtures.json"), "utf8"),
	);

export const createMockServer = (fixtures: Fixture[]): http.Server =>
	http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		const query = Object.fromEntries(url.searchParams.entries());
		const result = matchResponse(
			fixtures,
			req.method ?? "GET",
			url.pathname,
			query,
		);
		res.setHeader("Content-Type", "application/json");
		if (!result) {
			res.statusCode = 404;
			res.end(JSON.stringify({ status: 1, message: "No mock for this route" }));
			return;
		}
		res.statusCode = result.statusCode;
		res.end(JSON.stringify(result.body));
	});
