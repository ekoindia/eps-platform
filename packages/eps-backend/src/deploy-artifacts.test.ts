import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Backend package is ESM ("type":"module") — derive __dirname from import.meta.
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, ".."); // packages/eps-backend
const compose = () =>
	readFileSync(resolve(root, "docker-compose.prod.yml"), "utf8");

describe("docker-compose.prod.yml", () => {
	it("runs the backend by injected digest, never rebuilt from root", () => {
		const c = compose();
		expect(c).toContain("image: ${EPS_BACKEND_IMAGE}");
		expect(c).not.toContain("context: ../.."); // poller may build; backend must not
	});
	it("publishes only on loopback", () => {
		expect(compose()).toContain("127.0.0.1:8787:8787");
	});
	it("keeps redis isolated and gives backend+poller egress", () => {
		const c = compose();
		expect(c).toMatch(/eps-internal:\s*\n\s*internal:\s*true/);
		expect(c).toContain("eps-egress");
		// redis must be reachable ONLY on the internal network, never egress
		const redisBlock = c.slice(
			c.indexOf("  redis:"),
			c.indexOf("  eps-backend:"),
		);
		expect(redisBlock).toContain("eps-internal");
		expect(redisBlock).not.toContain("eps-egress");
	});
	it("does not interpolate POLLER_ALERT_WEBHOOK in compose (it comes from .env)", () => {
		expect(compose()).not.toContain("${POLLER_ALERT_WEBHOOK");
	});
	it("caps rotated log files", () => {
		expect(compose()).toContain('max-file: "5"');
	});
	it("rotates logs and restarts services", () => {
		const c = compose();
		expect(c).toContain('max-size: "10m"');
		expect(c).toContain("restart: unless-stopped");
	});
	it("uses a curl-free node healthcheck", () => {
		expect(compose()).toContain("process.exit(r.ok?0:1)");
	});
	it("loads secrets via env_file but NOT for image interpolation", () => {
		expect(compose()).toMatch(/env_file:\s*\n\s*- \.env/);
	});
});
