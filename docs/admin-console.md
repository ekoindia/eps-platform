# Admin Config Console

The Admin Config Console v1 is an in-browser GitOps editor that allows admins to edit documentation and endpoint notes directly from the `/admin` page, with changes automatically committed to the repository via GitHub PRs.

## Purpose

Admins can edit two categories of editable content without leaving the UI:
- **Guides:** Documentation files in `src/content/docs/*.mdx`
- **Endpoint notes:** Short descriptions in `src/content/docs/endpoints/*.md`

All edits are committed to the repository as pull requests, ensuring code review visibility and deploy-preview testing before merging to production.

## Edit Flow (Flow A)

1. Navigate to `/admin` → **Edit Docs** section.
2. Select a guide or endpoint note from the list.
3. Edit in the CodeMirror editor.
4. Click **Propose changes**.
5. The backend:
   - Branches off the base (`dev` by default, configurable via `GITHUB_EDIT_BASE`).
   - Commits the changes using the admin's persisted GitHub OAuth token (keyed by session ID).
   - Opens a pull request into the base branch.
6. The repository's CI/CD pipeline:
   - Builds a deploy preview for the PR.
   - Displays the link in the frontend (admin notified).
7. Admin (or another reviewer) merges the PR → changes land on the dev branch.

## Deploy Flow (Flow B)

1. From the `/admin` page, click **Deploy to production**.
2. The backend:
   - Opens a pull request from `dev` into `main` (configurable via `GITHUB_PROD_BASE`).
   - Commit message includes a timestamp and identifies the triggering admin.
3. The repository's CI/CD builds a deploy preview.
4. A human reviewer merges the PR → changes land on `main`.
5. The host's git integration detects the push to `main` and triggers the production build automatically (no separate deploy GitHub Action).

## Editable File Allowlist

Only the following files may be edited:
- `src/content/docs/**/*.mdx` (guides)
- `src/content/docs/endpoints/**/*.md` (endpoint notes)

The backend rejects edits to any other path. Additionally:
- Path traversal attempts (e.g., `../../`) are rejected.
- Control characters are rejected.
- Only `.md` and `.mdx` extensions are allowed.

## Persisted Admin Token Model

When an admin logs in via GitHub OAuth, the backend persists their GitHub token server-side, keyed by session ID (`sid`). This token is used to author commits on behalf of the admin. The token is automatically revoked when the session expires or the admin logs out.

If the token is missing or revoked (e.g., admin revoked access), write operations (edit or deploy) return a `401 NO_GH_TOKEN` error. Reads (list and view) are unaffected.

## Security

- **Route gating:** All endpoints are gated on `role === "admin"`. Non-admin requests receive a `403 Forbidden` response.
- **Allowlist + sanitization:** Only whitelisted file paths and extensions are accepted. Path traversal and control characters are rejected.
- **Token scoping:** Each admin's token is specific to their session, preventing cross-user token misuse.
- **Commit authorship:** Commits are authored by the admin who proposed or deployed, not a bot, ensuring accountability.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_EDIT_BASE` | `dev` | The branch that new edit PRs branch from and merge into. |
| `GITHUB_PROD_BASE` | `main` | The branch that deploy PRs target (always branches from `GITHUB_EDIT_BASE`). |

## Error Responses

The API returns the following error codes for edit and deploy operations:

- **400 BAD_PATH:** Attempted to edit an unsupported file path.
- **401 NO_GH_TOKEN:** Admin's GitHub token is missing or revoked.
- **403 Forbidden:** Requester is not an admin.
- **409 STALE_CONTENT:** The file's content on the backend differs from the editor's version (concurrent edit detected). Refresh and retry.
- **409 NOTHING_TO_DEPLOY:** The deploy PR would have no new commits (dev and main are already in sync).
- **502 UPSTREAM_ERROR:** GitHub API request failed.

## Deferred to Future Phases

The following features are intentionally not included in v1:
- **Structured-data forms:** A form-based editor for frontmatter, metrics, or metadata (currently edit as raw markdown).
- **Blog MDX editor:** Editing blog posts (currently only guides and endpoint notes).
- **Create new docs:** Only existing files can be edited; new docs must be created via git.
- **Inline preview:** Live HTML preview while editing (Propose to trigger a deploy preview instead).

These may be added in v2 based on usage feedback and team priorities.
