# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-03

First release. 0.1.0 was never published to npm or tagged.

### Added
- `today` in place of a date, in the CLI and the MCP tools: `au-bizdays add 10 --from today --state WA`. It is the date on the clock of the state's capital, so the machine's timezone makes no difference. `AU_BIZDAYS_NOW` fixes the instant for tests.
- `docs/commands.md` and `docs/data.md`, with the reference material that used to make the README long. Both carry output generated from the code.
- A `publish` workflow and `scripts/release.mjs`. A merge that raises the version publishes to npm with provenance and creates the GitHub Release from this file. It can also be started by hand, and it ends green with a notice when there is no `NPM_TOKEN` secret and the package is not on npm yet.
- A written record of how the data was checked and how fresh it is, in `docs/data.md`.

### Fixed
- Tasmania: removed Easter Sunday for 2027 and 2028, which Tasmania's table does not list, and added Saturday 25 December 2027, which the Tasmanian substitute rule makes a holiday alongside Monday 27 December. No business-day answer changes.
- Victoria: the Friday before the AFL Grand Final in 2027 moves from 24 September to 1 October, from the AFL's announced Grand Final date of Saturday 2 October. It stays `estimated` until the holiday is gazetted. The refresh script now knows the AFL's date, so it no longer puts the Friday back.
- Error text for a bad date now says that `today` is accepted.

### Changed
- README rewritten around a first run, an install line that works today, alternatives and when not to use this. Reference material moved to `docs/`.
- Development dependencies: TypeScript 5.9 to 7.0 and `@types/node` 22 to 26 (the two open Dependabot pull requests).

## [0.1.0] - 2026-11-02

Internal first version. Not published.

### Added
- `au-bizdays` command line tool: `add`, `diff`, `is`, `next`, `prev`, `roll`, `add-calendar` and `holidays`, for ACT, NSW, NT, QLD, SA, TAS, VIC and WA. `--json` output with the documented `au-bizdays/v1` schema. Exit codes 0 ok, 2 usage error, 3 date outside the bundled data.
- `au-bizdays-mcp`, a read-only MCP server over stdio with eight tools mirroring the commands.
- Public holidays for 2025 to 2028 for every state, each year file recording its official source URL and retrieval date, and each entry marked confirmed or estimated.
- Caveats on every result: the business-day definition, regional holidays not counted, estimated and part-day holidays the answer touched, and a warning when today is within 60 days of the end of the data.
- `scripts/refresh-holidays.mjs` to compare the bundled data with the official pages (`--check`) or update it (`--write`), and a monthly workflow that opens a pull request when the data changed.
