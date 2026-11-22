# au-bizdays: decisions

Why the project is the way it is, newest first. One entry per decision: the date it was made, what was decided, and why. Entries are records: when a decision stops being true, leave it and add `Superseded YYYY-MM-DD: <what replaced it>.` to its end, then add the new decision above.

- 2026-11-03: `today` is the date on the state capital's clock, not the machine's. Why: the answer must not depend on where the command runs (CHANGELOG.md 0.2.0).
- 2026-11-03: Publish to npm only from a workflow, with provenance, when package.json carries a version npm lacks; with no `NPM_TOKEN` and nothing on npm yet it ends green with a notice. Why: no npm release until the owner sets the token and starts the first run by hand (.github/workflows/publish.yml).
- 2026-11-02: A date outside the bundled holiday data is an error (exit 3) and no holiday is extrapolated. Why: a guessed holiday gives a wrong deadline with no warning (CONTRIBUTING.md, src/calendar.ts).
- 2026-11-02: Public repo under MIT, shipped as both a CLI and a read-only MCP server, with data read from the official state lists and a scheduled refresh job. Why: an agent needs a deterministic per-state answer it can check against a source, and the business-day MCP servers compared in README.md either take a country code only or cannot add business days. The refresh job runs monthly, not yearly, and can only fetch ACT, NSW, QLD and WA; the other four states are checked from saved pages (.github/workflows/refresh-holidays.yml, docs/data.md).
