/**
 * The build this process is running.
 *
 * Read from the environment rather than baked in by the bundler so one image
 * can be stamped at `docker build` time (`--build-arg EPS_VERSION=$(git rev-parse
 * --short HEAD)`) without a separate compile. Falls back to `dev` for local runs
 * and any build that forgot to set it — an honest "unknown" beats a stale
 * constant that claims to be a release.
 *
 * Surfaced on the `x-eps-version` response header and in the error envelope,
 * because "is production actually running this code?" is the question that
 * precedes every other one during an incident.
 */
export const API_VERSION: string = process.env.EPS_VERSION?.trim() || "dev";
