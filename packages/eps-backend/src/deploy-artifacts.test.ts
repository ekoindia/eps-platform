import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
	it("gives the poller GHCR credentials for skopeo (private package)", () => {
		const c = compose();
		expect(c).toContain("REGISTRY_AUTH_FILE: /root/.docker/config.json");
		expect(c).toContain("./.ghcr-auth.json:/root/.docker/config.json:ro");
	});
});

describe("Dockerfile", () => {
	const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");

	// Regression: jose@5 (this package) vs jose@6 (hoisted for
	// @modelcontextprotocol/sdk) made npm nest jose under
	// packages/eps-backend/node_modules. The runtime stage copied only the root
	// node_modules and flattened dist into /app, so the nested deps were
	// invisible and the container crash-looped on ERR_MODULE_NOT_FOUND. Copying
	// the whole resolved tree keeps that true however npm decides to nest.
	it("ships the whole resolved dependency tree, not hand-picked paths", () => {
		expect(dockerfile).toContain("COPY --from=proddeps /app /app");
		expect(dockerfile).not.toMatch(
			/COPY --from=\S+ \S*packages\/eps-backend\/node_modules/,
		);
	});
	it("runs from the workspace path so upward resolution reaches both trees", () => {
		expect(dockerfile).toContain("WORKDIR /app/packages/eps-backend");
	});
	// Dev deps are dead weight on a vfs-backed VM: no layer sharing means image
	// size is paid again in full on every pull and every container create.
	it("installs runtime deps without devDependencies", () => {
		expect(dockerfile).toMatch(/FROM \S+ AS proddeps/);
		expect(dockerfile).toMatch(/npm ci .*--omit=dev/);
		// dist is the one thing that must come from the build stage; node_modules
		// must not, or the pruned tree is silently bypassed.
		expect(dockerfile).toContain(
			"COPY --from=build /app/packages/eps-backend/dist ./dist",
		);
		expect(dockerfile).not.toMatch(/COPY --from=build \S*node_modules/);
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

const healthScript = () =>
	readFileSync(resolve(root, "deploy/health.sh"), "utf8");

describe("deploy/health.sh", () => {
	it("drives Compose through the invariant 4-flag form", () => {
		const s = healthScript();
		expect(s).toContain('docker compose -p "$PROJECT"');
		expect(s).toContain('--project-directory "$DIR"');
		expect(s).toContain('--env-file "$DIR/deploy.env"');
		expect(s).toContain('-f "$DIR/docker-compose.prod.yml"');
	});
	// The whole value of this script is that an operator can run it on prod
	// without thinking. A mutating verb sneaking in would break that contract.
	it("stays read-only — no mutating compose or docker verb", () => {
		const s = healthScript();
		for (const verb of [
			"dc up",
			"dc down",
			"dc restart",
			"dc rm",
			"dc stop",
			"dc pull",
			"docker rm",
			"docker rmi",
			"docker volume rm",
			"system prune",
			"image prune",
		]) {
			expect(s).not.toContain(verb);
		}
		// It may PRINT the HOLD-clearing command, but must never run one.
		expect(s).not.toMatch(/^\s*docker run .*rm -f \/state/m);
	});
	// Behavioural, not textual: the help path must not touch docker, so this is
	// safe to run anywhere — including a CI box with no stack.
	it("prints the usage guide and exits 0 when run with no arguments", () => {
		const run = spawnSync("bash", [resolve(root, "deploy/health.sh")], {
			encoding: "utf8",
		});
		expect(run.status).toBe(0);
		expect(run.stdout).toContain("USAGE");
		for (const mode of ["full", "logs", "poller", "help"]) {
			expect(run.stdout).toContain(`health.sh ${mode}`);
		}
		// Documents every knob an operator can override.
		for (const knob of ["PROJECT", "DIR", "SERVICE", "PORT", "STATE_VOL"]) {
			expect(run.stdout).toContain(knob);
		}
	});
	it("rejects an unknown mode with exit 2", () => {
		const run = spawnSync("bash", [resolve(root, "deploy/health.sh"), "bogus"], {
			encoding: "utf8",
		});
		expect(run.status).toBe(2);
		expect(run.stderr).toContain("unknown mode");
	});
	it("parameterizes every stack-specific value so the transact stack reuses it", () => {
		const s = healthScript();
		for (const knob of [
			"PROJECT",
			"DIR",
			"SERVICE",
			"PORT",
			"STATE_VOL",
			"IMAGE_ENV_KEY",
		]) {
			expect(s).toContain(`${knob}="\${${knob}:-`);
		}
	});
});
