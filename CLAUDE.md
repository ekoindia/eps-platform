## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- `graphify-out/` is generated and gitignored. Only `.graphify_labels.json` (+ `.sig`) and `cache/semantic/` are committed — the LLM-derived seed. After a fresh clone run `graphify .` once to rebuild `graph.json` locally; the committed semantic cache (content-addressed by prompt fingerprint + file hash) and community labels are reused, so the rebuild costs no API tokens. Seed produced with graphify 0.9.31.
- Never `git add -f` anything else under `graphify-out/`. Commit `cache/semantic/` additions only when the source change genuinely refreshes the shared seed (new/edited docs), and drop stale entries with a periodic `graphify` full run, which prunes cache entries whose source files are gone.
