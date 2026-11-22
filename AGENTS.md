---
slug: au-bizdays-agents
name: au-bizdays agent guide
repo: .
status: active
last_verified: 2026-11-22
---

# au-bizdays: guide for coding agents

The doc index is docs/README.md. Read docs/ARCHITECTURE.md before changing structure. README.md is the product description; docs/commands.md and docs/data.md are the reference.

## Commands

- Install: `npm install` (or `npm ci`). `prepare` runs the build, so install also writes `dist/`. Node 18 or newer. <!-- src: package.json#scripts.prepare, package.json#engines.node -->
- Build: `npm run build` (tsc into `dist/`, then marks `dist/cli.js` and `dist/mcp.js` executable). <!-- src: package.json#scripts.build -->
- Run the CLI from a checkout: `node dist/cli.js add 10 --from 2026-12-18 --state WA`. The MCP server is `node dist/mcp.js`, started by an MCP client over stdio, not by hand. <!-- src: package.json#bin, src/mcp.ts:7-10 -->
- Lint and typecheck: `npm run lint` (tsc `--noEmit`, the em dash check, and `node --check` on each script). There is no formatter. <!-- src: package.json#scripts.lint, scripts/check-text.mjs -->
- Test: `npm test` builds first, then runs `node --test test/*.test.mjs` against the built `dist/`. One file while iterating: `npm run build && node --test test/arithmetic.test.mjs`. <!-- src: package.json#scripts.pretest, package.json#scripts.test, test/helpers.mjs:9-14 -->
- Timezone check: `npm run test:tz` reruns the suite under `TZ=Australia/Perth` and `TZ=America/Los_Angeles`. <!-- src: package.json#scripts.test:tz -->
- Generated blocks: `npm run assets` rewrites the demo and sources blocks in README.md, docs/commands.md and docs/data.md from the built CLI and the data; `npm run check` is lint plus a staleness check of those blocks. <!-- src: package.json#scripts.assets, package.json#scripts.check, scripts/render-demo.mjs:1-6 -->
- Holiday data: `npm run refresh` compares `data/` with the official pages; `node scripts/refresh-holidays.mjs --write` updates it. Needs network. <!-- src: package.json#scripts.refresh, scripts/refresh-holidays.mjs:1-19 -->
- CI runs lint, build, test, test:tz and `npm pack --dry-run` on Node 18 and 22. <!-- src: .github/workflows/ci.yml -->

## Conventions

- `src/commands.ts` holds the eight operations, shared by the CLI and the MCP server so both give the same answer and the same error text. A new command goes there first, then into `src/cli.ts` and `src/server.ts`. <!-- src: src/commands.ts:1-2, src/cli.ts:23-86, src/server.ts:60-122 -->
- `src/calendar.ts` is pure: no file, clock or timezone reads. The clock comes in through a `Context`, and `src/data.ts` is the only filesystem access in the package. <!-- src: src/calendar.ts:1-2, src/commands.ts:38-42, src/data.ts:57 -->
- Dates are day numbers, never `Date` objects, so the machine timezone cannot change an answer. The word `today` is resolved on the state capital's clock in `src/clock.ts`. <!-- src: src/date.ts:1-2, src/clock.ts:4-14, CONTRIBUTING.md -->
- Holiday data comes from official government pages, with `source_url` and `retrieved_on` in every year file. Never guess a holiday: a date outside the data is an error, and anything the source has not fixed is `estimated`. Change data with the refresh script, not by hand, unless a year is published nowhere yet. <!-- src: CONTRIBUTING.md, src/data.ts:46-49 -->
- Runtime dependencies are the MCP SDK and zod only; a test pins them, along with `files` in package.json and `mcpName`. <!-- src: test/readme.test.mjs:83-91, CONTRIBUTING.md -->
- A release raises the version in package.json, src/version.ts and server.json together and adds a `## [x.y.z]` section to CHANGELOG.md; tests check both. <!-- src: .github/workflows/publish.yml:3-5, test/readme.test.mjs:83-91, test/release.test.mjs:86 -->
- Plain English, no em dashes, no marketing words. Commit messages are plain sentences with no prefix. <!-- src: CONTRIBUTING.md, scripts/check-text.mjs -->

## Traps

- The repo is public. A test fails on an em dash or a local home path (`/home/` or `/Users/`) in any tracked text file, docs included: write `~/` paths and placeholders. <!-- src: test/readme.test.mjs:93-102 -->
- The demo blocks in README.md and docs/commands.md are generated and a test fails when they go stale. After any change to command output or data, run `npm run assets` and commit the result. <!-- src: test/readme.test.mjs:12-18, scripts/render-demo.mjs:1-6 -->
- A test fails unless the docs mention every MCP tool name and every JSON result field in backticks, and another rejects novelty claims ("first", "only", "unique" near "tool" or "server") in README.md and docs. <!-- src: test/readme.test.mjs:53-80 -->
- Tests run the built `dist/`, so a test run on stale output tests old code. `npm test` rebuilds; a bare `node --test` does not. <!-- src: package.json#scripts.pretest, test/helpers.mjs:9-14 -->
- `src/server.ts` replaces the SDK's `tools/call` handler so bad arguments reach `commands.ts` and come back with the CLI's error text. A tool registered without going through `register()` will not be callable. <!-- src: src/server.ts:124-132 -->
- On the MCP server stdout is the protocol channel; status goes to stderr. <!-- src: src/mcp.ts:20-27 -->
- The VIC parser needs the AFL Grand Final date in `AFL_GRAND_FINAL`, or a refresh puts Victoria's Friday holiday back to the last Friday in September. <!-- src: scripts/lib/parse.mjs:359-364, docs/data.md -->
- The VIC, NT, TAS and SA sites block scripts, so the refresh reports them as blocked; check those from pages saved in a browser with `--pages-dir`. <!-- src: scripts/refresh-holidays.mjs:21-22, .github/workflows/refresh-holidays.yml:10-11 -->
- `AU_BIZDAYS_NOW` (an ISO instant with a zone) and `AU_BIZDAYS_TODAY` (YYYY-MM-DD) fix the clock; tests depend on them. <!-- src: src/clock.ts:18-42 -->

## Unverified

- None.
