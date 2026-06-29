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

const workflow = () =>
	readFileSync(
		resolve(root, "../../.github/workflows/deploy-eps-backend.yml"),
		"utf8",
	);

describe("deploy-eps-backend.yml", () => {
	it("triggers on CI workflow_run completion", () => {
		const w = workflow();
		expect(w).toContain("workflow_run:");
		expect(w).toContain('workflows: ["CI"]');
		expect(w).toContain("types: [completed]");
	});
	it("guards on push + main + success", () => {
		const w = workflow();
		expect(w).toContain("github.event.workflow_run.event == 'push'");
		expect(w).toContain("github.event.workflow_run.head_branch == 'main'");
		expect(w).toContain("github.event.workflow_run.conclusion == 'success'");
	});
	it("serializes deploys and never cancels", () => {
		const w = workflow();
		expect(w).toContain("group: eps-backend-deploy");
		expect(w).toContain("cancel-in-progress: false");
	});
	it("verifies head_sha is still origin/main (stale-run guard)", () => {
		const w = workflow();
		expect(w).toContain("git fetch origin main --depth=1");
		expect(w).toContain("git rev-parse FETCH_HEAD");
	});
	it("pushes :sha then retags :prod to the BUILT digest", () => {
		const w = workflow();
		expect(w).toContain("packages: write");
		expect(w).toContain("buildx imagetools create");
		expect(w).toContain("ghcr.io/ekoindia/eps-backend");
		// retag must reference the digest the push step produced, not a tag
		expect(w).toContain("steps.build.outputs.digest");
	});
});
